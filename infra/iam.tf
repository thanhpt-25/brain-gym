# ─────────────────────────────────────────────
# ECS Task Execution Role
# Allows ECS agent to pull ECR images and fetch
# secrets from Secrets Manager on behalf of tasks
# ─────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.app_name}-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-ecs-execution"
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "secrets-manager-read"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}/${var.environment}/*"
    }]
  })
}

# ─────────────────────────────────────────────
# ECS Task Role
# Assumed by the running application itself
# Add permissions here if the app needs to call
# other AWS services (S3, SQS, etc.)
# ─────────────────────────────────────────────
resource "aws_iam_role" "ecs_task" {
  name = "${var.app_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-ecs-task"
  })
}

# Allow the ECS task to generate presigned PUT URLs and manage avatar objects.
# No static access keys — the task inherits credentials from this role automatically.
resource "aws_iam_role_policy" "ecs_task_avatars" {
  name = "s3-avatars"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AvatarsBucket"
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
      ]
      Resource = "${aws_s3_bucket.avatars.arn}/*"
    }]
  })
}

# Allow the ECS task to stage uploaded files and invoke the Markitdown Lambda.
resource "aws_iam_role_policy" "ecs_task_markitdown" {
  name = "markitdown-pipeline"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "MaterialsTmpBucket"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.materials_tmp.arn}/*"
      },
      {
        Sid      = "InvokeMarkitdownLambda"
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.markitdown.arn
      }
    ]
  })
}

# ─────────────────────────────────────────────
# GitHub Actions Deploy Role (OIDC)
# Assumed by GitHub Actions via OIDC — no static
# AWS keys needed in GitHub secrets
# ─────────────────────────────────────────────
data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  # Create once — reuse if it already exists by importing:
  # terraform import aws_iam_openid_connect_provider.github arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = merge(var.common_tags, {
    Name = "github-actions-oidc"
  })
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.app_name}-deploy-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = local.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:environment:${var.environment}"
        }
      }
    }]
  })

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-deploy-${var.environment}"
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "${var.app_name}-deploy-${var.environment}"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECR"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECS"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RunTask"
        ]
        Resource = "*"
      },
      {
        Sid    = "Lambda"
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction"
        ]
        Resource = aws_lambda_function.markitdown.arn
      },
      {
        Sid    = "PassRole"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
      },
      {
        Sid    = "S3Frontend"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*"
        ]
      },
      {
        Sid    = "CloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution"
        ]
        Resource = "*"
      },
      {
        Sid      = "SecretsManager"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}/${var.environment}/*"
      }
    ]
  })
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "ARN of the GitHub Actions deploy role — use as AWS_ROLE_ARN in GitHub secrets"
}
