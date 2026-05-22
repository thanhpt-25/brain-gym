# AWS Deployment Setup Guide

This guide walks through setting up CI/CD to deploy CertGym to AWS (ECS Fargate + RDS + ElastiCache + S3 + CloudFront).

## Prerequisites

- AWS account with appropriate permissions
- GitHub repository with branch protection rules enabled
- Docker images pushed to ECR
- Terraform or CDK (for infrastructure as code)

---

## Phase 1: AWS Infrastructure Setup

Use Terraform (recommended) or CloudFormation to provision:

### Networking
- VPC with 2 public + 2 private subnets across 2 AZs
- NAT Gateway for private subnets
- Security groups:
  - ALB: allow 80/443 from 0.0.0.0/0
  - ECS: allow 3000 from ALB, 5432 from ECS, 6379 from ECS
  - RDS: allow 5432 from ECS
  - ElastiCache: allow 6379 from ECS

### Compute & Storage
- **ECR Repository**: `braingym-backend` (shared across environments, tagged by commit SHA)
- **ECS Cluster**: `braingym-staging` and `braingym-production`
- **ECS Task Definition**: `braingym-backend` (Fargate, 512 CPU / 1024 MB memory minimum)
- **RDS PostgreSQL 16**: private subnets, multi-AZ recommended for prod
- **ElastiCache Redis 7**: private subnets, single-node for staging, cluster for prod
- **S3 Bucket**: private (BlockPublicAccess enabled), OAC for CloudFront
- **CloudFront Distribution**: 
  - Origin 1: S3 bucket (with OAC)
  - Origin 2: ALB (for /api/v1 routing)
  - Behaviors:
    - `/api/v1/*` → ALB
    - `/` → S3 with SPA error handling (403/404 → /index.html)
- **Application Load Balancer**: target group → ECS service, health check on `/api/v1/health`

### Secrets Management
Store in AWS Secrets Manager per environment:

```json
{
  "DATABASE_URL": "postgresql://braingym:PASSWORD@rds-endpoint:5432/braingym?schema=public",
  "JWT_SECRET": "...",
  "JWT_REFRESH_SECRET": "...",
  "LLM_KEY_ENCRYPTION_SECRET": "..."
}
```

### IAM

**OIDC Provider** (one-time setup):
```bash
aws iam create-openid-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Deploy Role** (per environment):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:OWNER/brain-gym:environment:ENVIRONMENT"
        }
      }
    }
  ]
}
```

**Inline Permissions** for the deploy role:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:REGION:ACCOUNT:repository/braingym-backend"
    },
    {
      "Sid": "ECSUpdate",
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:RunTask"
      ],
      "Resource": [
        "arn:aws:ecs:REGION:ACCOUNT:service/braingym-ENVIRONMENT/*",
        "arn:aws:ecs:REGION:ACCOUNT:task-definition/braingym-backend*",
        "arn:aws:ecs:REGION:ACCOUNT:cluster/braingym-ENVIRONMENT"
      ]
    },
    {
      "Sid": "PassRoleForECS",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
        "arn:aws:iam::ACCOUNT:role/ecsTaskRole"
      ]
    },
    {
      "Sid": "S3DeployFrontend",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::braingym-ENVIRONMENT-frontend",
        "arn:aws:s3:::braingym-ENVIRONMENT-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetDistribution"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SecretsManagerRead",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:braingym/ENVIRONMENT/*"
    }
  ]
}
```

---

## Phase 2: GitHub Secrets & Environment Configuration

### Repository Secrets (Settings > Secrets and Variables > Actions)

**Global:**
- None (all secrets per-environment)

### Environment Configuration (Settings > Environments)

Create two environments: `staging` and `production`

**Staging Environment Secrets:**
```
AWS_ROLE_ARN = arn:aws:iam::ACCOUNT:role/braingym-deploy-staging
AWS_ACCOUNT_ID = ACCOUNT
AWS_S3_BUCKET = braingym-staging-frontend
AWS_CLOUDFRONT_DISTRIBUTION_ID = E1234567890ABC
AWS_PRIVATE_SUBNET_IDS = subnet-xxx,subnet-yyy
AWS_ECS_SECURITY_GROUP = sg-xxx
VITE_API_BASE_URL = https://staging.braingym.dev/api/v1
DEPLOYMENT_ENDPOINT = https://staging.braingym.dev
```

**Production Environment Secrets:**
```
AWS_ROLE_ARN = arn:aws:iam::ACCOUNT:role/braingym-deploy-production
AWS_ACCOUNT_ID = ACCOUNT
AWS_S3_BUCKET = braingym-production-frontend
AWS_CLOUDFRONT_DISTRIBUTION_ID = E9876543210XYZ
AWS_PRIVATE_SUBNET_IDS = subnet-aaa,subnet-bbb
AWS_ECS_SECURITY_GROUP = sg-yyy
VITE_API_BASE_URL = https://braingym.com/api/v1
DEPLOYMENT_ENDPOINT = https://braingym.com
```

**Production Environment Protection Rules:**
- Require review from code owners
- Dismiss stale pull request approvals
- Require the latest commit

---

## Phase 3: ECS Task Definitions

### Main Task Definition (`braingym-backend`)

```json
{
  "family": "braingym-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "braingym-backend",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/braingym-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:braingym/ENVIRONMENT/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:braingym/ENVIRONMENT/jwt-secret"
        },
        {
          "name": "JWT_REFRESH_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:braingym/ENVIRONMENT/jwt-refresh-secret"
        },
        {
          "name": "LLM_KEY_ENCRYPTION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:braingym/ENVIRONMENT/llm-encryption-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/braingym-backend",
          "awslogs-region": "REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole"
}
```

### Migration Task Definition (`braingym-backend-migrate`)

Same as above, but used as a one-off task triggered by `aws ecs run-task` with command override `["sh", "docker-entrypoint.sh", "migrate"]`.

---

## Phase 4: Deploy Workflow

The `.github/workflows/deploy.yml` workflow automates:

1. **Build & Push** — Docker image tagged by commit SHA to ECR
2. **Migrate DB** — Run one-off ECS task to execute migrations
3. **Deploy Backend** — Update ECS service with new image, wait for stability
4. **Deploy Frontend** — Build Vite + sync to S3 + invalidate CloudFront
5. **Smoke Test** — Health check on deployed endpoints

### Triggers

- **Push to `main`** → auto-deploy to **staging**
- **Manual trigger** or **git tag `v*`** → deploy to **production** (requires approval)

### Rollback

If smoke test fails or issues occur:
1. Manual: `aws ecs update-service --cluster braingym-production --service braingym-backend --task-definition braingym-backend:PREVIOUS_REVISION`
2. Frontend: CloudFront distributions keep prior versions; can revert via S3 version history

---

## Phase 5: Local Testing

Before deploying to staging, test the workflow locally:

```bash
# Build backend image
docker build -t braingym-backend:test ./backend

# Test migration mode
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  braingym-backend:test \
  sh docker-entrypoint.sh migrate

# Test app startup (only runs migrations in dev, not prod)
docker run --rm \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  braingym-backend:test

# Build frontend
npm run build
ls dist/
```

---

## Monitoring & Troubleshooting

### CloudWatch Logs
- Backend: `/ecs/braingym-backend`
- ECS: CloudWatch Insights queries for task failures

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Task fails to start | Missing secrets in Secrets Manager | Verify all secrets exist in AWS Secrets Manager |
| Migration timeout | Database unreachable | Check RDS security group allows ECS access |
| Frontend 403 errors | S3 not in CloudFront OAC | Verify CloudFront OAC permissions on S3 bucket |
| API health check fails | ALB route misconfigured | Ensure target group health check targets `/api/v1/health` |

---

## Cost Estimation (Monthly)

| Component | Staging | Production | Notes |
|-----------|---------|------------|-------|
| ECS Fargate | $15 | $30 | Depends on vCPU hours |
| RDS PostgreSQL | $30 | $100+ | Multi-AZ for prod |
| ElastiCache Redis | $20 | $50+ | Cluster mode for prod |
| S3 + CloudFront | $1-5 | $5-20 | CDN egress costs |
| **Total** | **~$70** | **~$200+** | |

