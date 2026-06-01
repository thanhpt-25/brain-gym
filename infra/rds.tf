# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-db-subnet-group"
  })
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier                  = "${var.app_name}-${var.environment}"
  engine                      = "postgres"
  engine_version              = "16"
  allow_major_version_upgrade = false
  auto_minor_version_upgrade  = true
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  storage_type                = "gp3"
  storage_encrypted           = true
  multi_az                    = var.db_multi_az
  publicly_accessible         = false

  db_name  = "braingym"
  username = "braingym"
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.db_backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  copy_tags_to_snapshot   = true

  skip_final_snapshot       = var.environment == "staging" ? true : false
  final_snapshot_identifier = var.environment == "production" ? "${var.app_name}-${var.environment}-final-${random_id.snapshot_suffix.hex}" : null
  deletion_protection       = var.environment == "production"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-postgres"
  })

  depends_on = [aws_security_group.rds]
}

# Generate secure DB password. Restricted to URL-safe symbols since this value is
# embedded directly into DATABASE_URL (chars like # % @ / : would corrupt the URL).
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "-_.~"
}

# Suffix for the final snapshot identifier (snapshot IDs can't contain colons/parens)
resource "random_id" "snapshot_suffix" {
  byte_length = 4
}

# Store DB password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.app_name}/${var.environment}/db-password"
  recovery_window_in_days = 0

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-db-password"
  })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.app_name}/${var.environment}/database-url"
  recovery_window_in_days = 0

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-database-url"
  })
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

resource "aws_secretsmanager_secret" "app_secrets" {
  for_each                = local.app_secrets
  name                    = "${var.app_name}/${var.environment}/${each.key}"
  recovery_window_in_days = 0

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-${each.key}"
  })
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  for_each      = local.app_secrets
  secret_id     = aws_secretsmanager_secret.app_secrets[each.key].id
  secret_string = each.value
}
