# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-cluster"
  })
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ─────────────────────────────────────────────
# Task Definition — main service
# The image tag is set to :latest here as a
# bootstrap. CI/CD renders a new revision with
# the SHA-pinned image on every deploy using
# amazon-ecs-render-task-definition.
# ─────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.app_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.app_name}-backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
        { name = "REDIS_PORT", value = tostring(aws_elasticache_replication_group.redis.port) },
        { name = "CORS_ORIGINS", value = "https://${var.domain_name},https://www.${var.domain_name},https://${aws_cloudfront_distribution.main.domain_name}" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_S3_AVATARS_BUCKET", value = aws_s3_bucket.avatars.bucket },
        { name = "AWS_AVATARS_CDN_BASE_URL", value = "https://${var.domain_name}" },
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.app_secrets["jwt-secret"].arn
        },
        {
          name      = "JWT_REFRESH_SECRET"
          valueFrom = aws_secretsmanager_secret.app_secrets["jwt-refresh-secret"].arn
        },
        {
          name      = "LLM_KEY_ENCRYPTION_SECRET"
          valueFrom = aws_secretsmanager_secret.app_secrets["llm-encryption-secret"].arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-backend-task"
  })
}

# ─────────────────────────────────────────────
# Task Definition — migration (one-off)
# Identical to the service task def but without
# port mappings. CI/CD runs this before deploying
# the service using: docker-entrypoint.sh migrate
# ─────────────────────────────────────────────
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.app_name}-backend-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.app_name}-backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      command = ["sh", "docker-entrypoint.sh", "migrate"]

      environment = [
        { name = "NODE_ENV", value = "production" }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migrate"
        }
      }
    }
  ])

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-migrate-task"
  })
}

# ─────────────────────────────────────────────
# ECS Service
# ─────────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name            = "${var.app_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  # Allow CI/CD to update the task definition without Terraform conflicts
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "${var.app_name}-backend"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_task_execution_managed
  ]

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-backend-service"
  })
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name — used in GitHub Actions deploy steps"
}

output "ecs_service_name" {
  value       = aws_ecs_service.backend.name
  description = "ECS service name — used in GitHub Actions deploy steps"
}

output "ecs_task_definition_family" {
  value       = aws_ecs_task_definition.backend.family
  description = "Task definition family — used by amazon-ecs-render-task-definition"
}

output "ecs_migrate_task_definition_family" {
  value       = aws_ecs_task_definition.migrate.family
  description = "Migration task definition family"
}
