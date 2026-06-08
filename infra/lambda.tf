# ─────────────────────────────────────────────
# ECR Repository — Markitdown Lambda container image
# ─────────────────────────────────────────────
resource "aws_ecr_repository" "markitdown" {
  name                 = "${var.app_name}-markitdown"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-markitdown"
  })
}

resource "aws_ecr_lifecycle_policy" "markitdown" {
  repository = aws_ecr_repository.markitdown.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# ─────────────────────────────────────────────
# IAM Role — Lambda execution role
# ─────────────────────────────────────────────
resource "aws_iam_role" "lambda_markitdown" {
  name = "${var.app_name}-${var.environment}-lambda-markitdown"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-lambda-markitdown"
  })
}

resource "aws_iam_role_policy_attachment" "lambda_markitdown_basic" {
  role       = aws_iam_role.lambda_markitdown.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_markitdown_s3" {
  name = "read-materials-tmp"
  role = aws_iam_role.lambda_markitdown.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadMaterialsTmp"
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${aws_s3_bucket.materials_tmp.arn}/*"
    }]
  })
}

# ─────────────────────────────────────────────
# CloudWatch Log Group
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "lambda_markitdown" {
  name              = "/aws/lambda/${var.app_name}-${var.environment}-markitdown"
  retention_in_days = 14

  tags = var.common_tags
}

# ─────────────────────────────────────────────
# Lambda Function — Markitdown converter
# Image is bootstrapped as :latest here; CI/CD
# updates the image URI on every deploy.
# ─────────────────────────────────────────────
resource "aws_lambda_function" "markitdown" {
  function_name = "${var.app_name}-${var.environment}-markitdown"
  role          = aws_iam_role.lambda_markitdown.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.markitdown.repository_url}:latest"

  timeout     = 300  # 5 minutes — enough for large PPTX/PDF
  memory_size = 1024

  environment {
    variables = {
      AWS_REGION_NAME = var.aws_region
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_markitdown,
    aws_iam_role_policy_attachment.lambda_markitdown_basic,
  ]

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-markitdown"
  })

  lifecycle {
    ignore_changes = [image_uri]
  }
}

output "markitdown_lambda_arn" {
  value       = aws_lambda_function.markitdown.arn
  description = "Markitdown Lambda ARN — use as AWS_MARKITDOWN_LAMBDA_ARN env var"
}

output "markitdown_ecr_repository_url" {
  value       = aws_ecr_repository.markitdown.repository_url
  description = "ECR URL for the Markitdown Lambda image"
}
