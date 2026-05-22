# VPC Outputs
output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

# Security Groups
output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

# RDS
output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  value = aws_db_instance.postgres.address
}

# ElastiCache
output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  value = aws_elasticache_cluster.redis.port
}

# GitHub Secrets Instruction
output "github_secrets_setup" {
  value = <<-EOT
# Add these to your GitHub Repository Settings > Environments > ${var.environment}

GitHub Environment Secrets for: ${var.environment}

AWS_ACCOUNT_ID = (your AWS account number)
AWS_ROLE_ARN = (from OIDC setup, see DEPLOYMENT_AWS.md)
AWS_S3_BUCKET = ${var.app_name}-${var.environment}-frontend
AWS_CLOUDFRONT_DISTRIBUTION_ID = (from CloudFront setup)
AWS_PRIVATE_SUBNET_IDS = ${join(",", aws_subnet.private[*].id)}
AWS_ECS_SECURITY_GROUP = ${aws_security_group.ecs.id}

Application Configuration:
VITE_API_BASE_URL = https://${var.environment}-braingym.example.com/api/v1
DEPLOYMENT_ENDPOINT = https://${var.environment}-braingym.example.com

Database (auto-created in Secrets Manager):
- ${aws_secretsmanager_secret.database_url.name}

Ensure these additional secrets exist in AWS Secrets Manager:
- ${var.app_name}/${var.environment}/jwt-secret
- ${var.app_name}/${var.environment}/jwt-refresh-secret
- ${var.app_name}/${var.environment}/llm-encryption-secret
EOT

  sensitive = true
}

# Summary for terraform output
output "deployment_summary" {
  value = <<-EOT
✓ Infrastructure created for: ${var.environment}

Key Resources:
- VPC: ${aws_vpc.main.id}
- Private Subnets: ${join(", ", aws_subnet.private[*].id)}
- RDS Endpoint: ${aws_db_instance.postgres.address}
- Redis Endpoint: ${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.port}
- ECR Repository: ${aws_ecr_repository.backend.repository_url}

Next Steps:
1. Run: terraform output -json > terraform-output.json
2. Copy AWS_PRIVATE_SUBNET_IDS and AWS_ECS_SECURITY_GROUP to GitHub Secrets
3. Create ECS cluster, task definitions, and ALB (see DEPLOYMENT_AWS.md)
4. Set up CloudFront distribution and S3 bucket
5. Configure GitHub OIDC role with permissions from DEPLOYMENT_AWS.md
EOT
}
