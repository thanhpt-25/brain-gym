# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-elasticache-subnet-group"
  })
}

# ElastiCache Redis (replication group — supports encryption, auth, failover, multi-node)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.app_name}-${var.environment}"
  description          = "${var.app_name} ${var.environment} Redis"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  parameter_group_name = "default.redis7"
  port                 = 6379

  # num_cache_clusters = primary + replicas. >1 enables automatic failover.
  num_cache_clusters         = var.redis_num_cache_nodes
  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled           = var.redis_num_cache_nodes > 1

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # At-rest encryption has no client impact, always on.
  at_rest_encryption_enabled = true

  # In-transit encryption + auth require the backend to use rediss:// with a
  # password. The app currently connects with plain REDIS_HOST/PORT, so this is
  # opt-in. Enable redis_transit_encryption only after the backend supports TLS+auth.
  transit_encryption_enabled = var.redis_transit_encryption
  auth_token                 = var.redis_transit_encryption ? random_password.redis_auth_token.result : null

  maintenance_window      = "mon:03:00-mon:04:00"
  notification_topic_arn  = var.environment == "production" ? aws_sns_topic.alerts[0].arn : null

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-redis"
  })

  depends_on = [aws_security_group.redis]
}

# Generate Redis AUTH token (auth_token disallows several special chars; restrict the set)
resource "random_password" "redis_auth_token" {
  length           = 32
  special          = true
  override_special = "!&#$^<>-"
}

# Store Redis AUTH token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "${var.app_name}/${var.environment}/redis-auth-token"
  recovery_window_in_days = 0

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-redis-auth-token"
  })
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}

# SNS Topic for alerts (production only)
resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-alerts"

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-alerts"
  })
}
