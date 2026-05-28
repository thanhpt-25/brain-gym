# S3 Bucket — React frontend static files
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.app_name}-${var.environment}-frontend"

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-frontend"
  })
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ─────────────────────────────────────────────
# CloudFront Origin Access Control (OAC)
# Allows CloudFront to access the private S3
# bucket without making it public
# ─────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.app_name}-${var.environment}-oac"
  description                       = "OAC for ${var.app_name} ${var.environment} frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 Bucket Policy — allows only CloudFront OAC to read objects
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontOAC"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })

  depends_on = [aws_cloudfront_distribution.main]
}

# ─────────────────────────────────────────────
# CloudFront Distribution
# Two origins:
#   1. S3 — serves the React SPA (default)
#   2. ALB — proxies /api/v1/* to NestJS
# ─────────────────────────────────────────────
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.app_name} ${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe only — cheapest

  aliases = [var.domain_name, "www.${var.domain_name}"]

  # Origin 1: S3 bucket (frontend)
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: S3 avatars bucket (user-uploaded images)
  origin {
    domain_name              = aws_s3_bucket.avatars.bucket_regional_domain_name
    origin_id                = "s3-avatars"
    origin_access_control_id = aws_cloudfront_origin_access_control.avatars.id
  }

  # Origin 3: ALB (backend API)
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb-backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Behavior 1: /avatars/* → S3 avatars (long-lived cache, immutable filenames)
  ordered_cache_behavior {
    path_pattern     = "/avatars/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-avatars"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # Behavior 2: /api/v1/* → ALB (no caching)
  ordered_cache_behavior {
    path_pattern     = "/api/v1/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-backend"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin", "Accept"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = false
  }

  # Default behavior: /* → S3 (SPA — cached aggressively)
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # SPA routing: return index.html for 403/404 so React Router handles paths
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cdn.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-cdn"
  })
}

# ─────────────────────────────────────────────
# S3 Bucket — Avatar uploads
# Private; served publicly through CloudFront /avatars/*
# Browsers upload directly via presigned PUT URLs
# signed by the ECS task role (no static credentials)
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "avatars" {
  bucket = "${var.app_name}-${var.environment}-avatars"

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-avatars"
  })
}

resource "aws_s3_bucket_public_access_block" "avatars" {
  bucket = aws_s3_bucket.avatars.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "avatars" {
  bucket = aws_s3_bucket.avatars.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS: allow browsers to PUT directly using presigned URLs
resource "aws_s3_bucket_cors_configuration" "avatars" {
  bucket = aws_s3_bucket.avatars.id

  cors_rule {
    allowed_headers = ["Content-Type", "Content-Length"]
    allowed_methods = ["PUT"]
    allowed_origins = [
      "https://${var.domain_name}",
      "https://www.${var.domain_name}",
      "https://${aws_cloudfront_distribution.main.domain_name}",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# OAC: let CloudFront read from the private avatars bucket
resource "aws_cloudfront_origin_access_control" "avatars" {
  name                              = "${var.app_name}-${var.environment}-avatars-oac"
  description                       = "OAC for ${var.app_name} ${var.environment} avatars"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Bucket policy: only CloudFront OAC can read objects
resource "aws_s3_bucket_policy" "avatars" {
  bucket = aws_s3_bucket.avatars.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontOAC"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.avatars.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })

  depends_on = [aws_cloudfront_distribution.main]
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.main.id
  description = "CloudFront distribution ID — use as AWS_CLOUDFRONT_DISTRIBUTION_ID in GitHub secrets"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main.domain_name
  description = "CloudFront domain — your staging URL (https://<this>/)"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.frontend.bucket
  description = "S3 bucket name — use as AWS_S3_BUCKET in GitHub secrets"
}

output "s3_avatars_bucket_name" {
  value       = aws_s3_bucket.avatars.bucket
  description = "Avatars S3 bucket — use as AWS_S3_AVATARS_BUCKET in ECS env / GitHub secrets"
}

output "avatars_cdn_base_url" {
  value       = "https://${aws_cloudfront_distribution.main.domain_name}/avatars"
  description = "CloudFront base URL for avatar files — use as AWS_AVATARS_CDN_BASE_URL in ECS env"
}
