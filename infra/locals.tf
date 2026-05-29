# CloudFront's fixed global hosted zone ID per AWS documentation
# Reference: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/resource-list.html
locals {
  cloudfront_hosted_zone_id = "Z2FDTNDATAQYW2"
}

# Construct DATABASE_URL from RDS endpoint and credentials
locals {
  database_url = "postgresql://braingym:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}?schema=public"
}

# Application secrets to be injected into Secrets Manager
# These are passed in via terraform.tfvars — never hardcode
locals {
  app_secrets = {
    "jwt-secret"            = var.jwt_secret
    "jwt-refresh-secret"    = var.jwt_refresh_secret
    "llm-encryption-secret" = var.llm_encryption_secret
  }
}

# GitHub OIDC provider ARN — either newly created or imported
locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}
