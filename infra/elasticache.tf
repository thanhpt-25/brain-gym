# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-elasticache-subnet-group"
  })
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.app_name}-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379

  subnet_group_name       = aws_elasticache_subnet_group.main.name
  security_group_ids      = [aws_security_group.redis.id]
  automatic_failover      = var.environment == "production" ? true : false
  at_rest_encryption      = true
  transit_encryption     = true
  auth_token             = random_password.redis_auth_token.result

  maintenance_window = "mon:03:00-mon:04:00"
  notification_topic_arn = var.environment == "production" ? aws_sns_topic.alerts[0].arn : null

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-redis"
  })

  depends_on = [aws_security_group.redis]
}

# Generate Redis AUTH token
resource "random_password" "redis_auth_token" {
  length  = 32
  special = true
}

# SNS Topic for alerts (production only)
resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-alerts"

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-alerts"
  })
}
