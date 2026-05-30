variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production"
  }
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "braingym"
}

variable "domain_name" {
  description = "Custom apex domain served via CloudFront (registered externally, DNS delegated to Route53)"
  type        = string
  default     = "brain-gym.biz"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# RDS Configuration
variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.micro" # staging
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_backup_retention_period" {
  description = "RDS backup retention in days"
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "RDS multi-AZ deployment"
  type        = bool
  default     = false # staging
}

# ElastiCache Configuration
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro" # staging
}

variable "redis_num_cache_nodes" {
  description = "Number of cache clusters (primary + replicas). >1 enables automatic failover + multi-AZ"
  type        = number
  default     = 1
}

variable "redis_transit_encryption" {
  description = "Enable in-transit encryption + AUTH token. Requires the backend to connect via rediss:// with a password — leave false until the app supports TLS+auth"
  type        = bool
  default     = false
}

# ECS Configuration
variable "ecs_task_cpu" {
  description = "ECS task CPU units"
  type        = string
  default     = "512"
}

variable "ecs_task_memory" {
  description = "ECS task memory in MB"
  type        = string
  default     = "1024"
}

variable "ecs_desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1 # staging
}

# Tags
variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
  }
}

# GitHub OIDC
variable "github_repo" {
  description = "GitHub repository in owner/repo format (e.g. thanhpt-25/brain-gym)"
  type        = string
  default     = "thanhpt-25/brain-gym"
}

variable "create_oidc_provider" {
  description = "Set to false if the GitHub OIDC provider already exists in this account"
  type        = bool
  default     = true
}

# Application secrets (injected into Secrets Manager)
variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret"
  type        = string
  sensitive   = true
}

variable "llm_encryption_secret" {
  description = "LLM key encryption secret"
  type        = string
  sensitive   = true
}

variable "dds_shadow_mode" {
  description = "DDS shadow mode flag. Set to 'false' to enable live mode and arm the canary."
  type        = string
  default     = "false"
}
