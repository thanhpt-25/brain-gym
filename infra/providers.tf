provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}

# CloudFront requires its ACM certificate to live in us-east-1,
# regardless of where the rest of the stack is deployed.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
