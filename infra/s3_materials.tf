# S3 Bucket — temporary staging area for uploaded study materials
# Objects are deleted automatically after 24 h via lifecycle rule.
# The ECS task uploads files here; the Lambda reads and converts them.
resource "aws_s3_bucket" "materials_tmp" {
  bucket = "${var.app_name}-${var.environment}-materials-tmp"

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-materials-tmp"
  })
}

resource "aws_s3_bucket_public_access_block" "materials_tmp" {
  bucket = aws_s3_bucket.materials_tmp.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "materials_tmp" {
  bucket = aws_s3_bucket.materials_tmp.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "materials_tmp" {
  bucket = aws_s3_bucket.materials_tmp.id

  rule {
    id     = "auto-delete-after-24h"
    status = "Enabled"

    filter { prefix = "uploads/" }

    expiration {
      days = 1
    }
  }
}

output "s3_materials_tmp_bucket_name" {
  value       = aws_s3_bucket.materials_tmp.bucket
  description = "Materials temp bucket — use as AWS_S3_MATERIALS_TMP_BUCKET env var"
}
