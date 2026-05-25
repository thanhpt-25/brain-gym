# AWS Console Setup — Step by Step

This guide walks you through every click needed to deploy CertGym on AWS ECS Fargate.
**Estimated time:** 2-3 hours (plus ~15 min waiting for RDS/ElastiCache to provision).

**Region:** Use `us-east-1` (N. Virginia) throughout. Every service must be in the same region.

---

## Overview of what you'll create

```
Internet → CloudFront → S3 (React frontend)
                     → ALB → ECS Fargate (NestJS backend)
                                   ↓               ↓
                               RDS PostgreSQL   ElastiCache Redis
```

---

## PART 1 — Networking (VPC)

### Step 1.1 — Create VPC

1. Go to **VPC** → **Your VPCs** → **Create VPC**
2. Select **VPC and more**
3. Fill in:
   - **Name tag auto-generation:** `braingym-staging`
   - **IPv4 CIDR block:** `10.0.0.0/16`
   - **Number of Availability Zones:** `2`
   - **Number of public subnets:** `2`
   - **Number of private subnets:** `2`
   - **NAT gateways:** `1 per AZ` *(staging: can use "In 1 AZ" to save cost)*
   - **VPC endpoints:** None
4. Click **Create VPC** → wait ~2 minutes

> ✅ This creates: 1 VPC, 2 public subnets, 2 private subnets, 1 internet gateway, NAT gateways, route tables automatically.

### Step 1.2 — Note your subnet and VPC IDs

1. Go to **VPC** → **Subnets**
2. Filter by your VPC name `braingym-staging`
3. Note these IDs (you'll need them later):
   - **Public subnet 1** (e.g. `subnet-aaaa`) — for ALB
   - **Public subnet 2** (e.g. `subnet-bbbb`) — for ALB
   - **Private subnet 1** (e.g. `subnet-cccc`) — for ECS/RDS/Redis
   - **Private subnet 2** (e.g. `subnet-dddd`) — for ECS/RDS/Redis
4. Go to **VPC** → **Your VPCs**, note the **VPC ID** (e.g. `vpc-xxxx`)

---

## PART 2 — Security Groups

### Step 2.1 — Security Group for ALB

1. Go to **VPC** → **Security Groups** → **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-alb`
   - **Description:** `ALB security group`
   - **VPC:** select `braingym-staging`
3. **Inbound rules** → Add rule:
   - Type: `HTTP`, Port: `80`, Source: `0.0.0.0/0`
   - Type: `HTTPS`, Port: `443`, Source: `0.0.0.0/0`
4. **Outbound rules:** leave default (All traffic)
5. Click **Create security group** → note the **SG ID** (e.g. `sg-alb-xxxx`)

### Step 2.2 — Security Group for ECS

1. **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-ecs`
   - **Description:** `ECS tasks security group`
   - **VPC:** `braingym-staging`
3. **Inbound rules** → Add rule:
   - Type: `Custom TCP`, Port: `3000`, Source: select **Custom** → type/select `braingym-staging-alb` security group
4. Click **Create security group** → note the **SG ID** (e.g. `sg-ecs-xxxx`)

### Step 2.3 — Security Group for RDS

1. **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-rds`
   - **Description:** `RDS security group`
   - **VPC:** `braingym-staging`
3. **Inbound rules** → Add rule:
   - Type: `PostgreSQL`, Port: `5432`, Source: select `braingym-staging-ecs` security group
4. Click **Create security group**

### Step 2.4 — Security Group for ElastiCache

1. **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-redis`
   - **Description:** `Redis security group`
   - **VPC:** `braingym-staging`
3. **Inbound rules** → Add rule:
   - Type: `Custom TCP`, Port: `6379`, Source: select `braingym-staging-ecs` security group
4. Click **Create security group**

---

## PART 3 — RDS PostgreSQL

### Step 3.1 — Create Subnet Group

1. Go to **RDS** → **Subnet groups** → **Create DB subnet group**
2. Fill in:
   - **Name:** `braingym-staging`
   - **Description:** `Braingym staging DB subnet group`
   - **VPC:** `braingym-staging`
3. **Add subnets:** select both **private subnets** (both AZs)
4. Click **Create**

### Step 3.2 — Create RDS Instance

1. Go to **RDS** → **Databases** → **Create database**
2. **Choose a database creation method:** Standard create
3. **Engine options:** PostgreSQL
4. **Engine version:** PostgreSQL 16.x (latest patch)
5. **Templates:** Free tier *(for staging)* or Dev/Test
6. **Settings:**
   - **DB instance identifier:** `braingym-staging`
   - **Master username:** `braingym`
   - **Master password:** generate a strong password → **copy and save it**
7. **Instance configuration:**
   - **DB instance class:** `db.t3.micro` (staging)
8. **Storage:**
   - **Storage type:** `gp3`
   - **Allocated storage:** `20 GB`
   - **Storage autoscaling:** enable, max `100 GB`
9. **Connectivity:**
   - **VPC:** `braingym-staging`
   - **DB subnet group:** `braingym-staging`
   - **Public access:** `No`
   - **VPC security group:** Remove default → add `braingym-staging-rds`
   - **Availability Zone:** No preference
10. **Database authentication:** Password authentication
11. **Additional configuration:**
    - **Initial database name:** `braingym`
    - **Backup retention:** `7 days`
    - **Maintenance window:** any
12. Click **Create database** → takes ~10 min to provision

> ⏳ Continue with the next steps while RDS provisions.

### Step 3.3 — Note RDS endpoint

After RDS is available:
1. Click on `braingym-staging` database
2. Under **Connectivity & security** → copy the **Endpoint** (e.g. `braingym-staging.xxxx.us-east-1.rds.amazonaws.com`)
3. Your `DATABASE_URL` will be:
   ```
   postgresql://braingym:PASSWORD@braingym-staging.xxxx.us-east-1.rds.amazonaws.com:5432/braingym?schema=public
   ```

---

## PART 4 — ElastiCache Redis

### Step 4.1 — Create Subnet Group

1. Go to **ElastiCache** → **Subnet groups** → **Create subnet group**
2. Fill in:
   - **Name:** `braingym-staging`
   - **Description:** `Braingym staging Redis subnet group`
   - **VPC:** `braingym-staging`
3. **Subnets:** select both **private subnets**
4. Click **Create**

### Step 4.2 — Create Redis Cluster

1. Go to **ElastiCache** → **Redis OSS caches** → **Create Redis OSS cache**
2. **Deployment option:** Design your own cache
3. **Creation method:** Easy create → **No** (use Standard create for more control)
4. Fill in:
   - **Cluster mode:** Disabled *(staging)*
   - **Name:** `braingym-staging`
   - **Engine version:** `7.0`
   - **Port:** `6379`
   - **Node type:** `cache.t3.micro`
   - **Number of replicas:** `0` *(staging — use 1 for production)*
5. **Subnet group:** `braingym-staging`
6. **Security groups:** remove default → add `braingym-staging-redis`
7. **Encryption at rest:** ✅ Enable
8. **Encryption in transit:** Leave **disabled** for now *(app doesn't yet support TLS auth)*
9. Click **Create** → takes ~5 min

### Step 4.3 — Note Redis endpoint

After available:
1. Click on `braingym-staging`
2. Copy the **Primary endpoint** (e.g. `braingym-staging.xxxx.cfg.use1.cache.amazonaws.com:6379`)

---

## PART 5 — Secrets Manager

### Step 5.1 — Store DATABASE_URL

1. Go to **Secrets Manager** → **Store a new secret**
2. **Secret type:** Other type of secret
3. **Key/value pairs** → switch to **Plaintext** tab
4. Paste your full DATABASE_URL:
   ```
   postgresql://braingym:YOUR_PASSWORD@braingym-staging.xxxx.us-east-1.rds.amazonaws.com:5432/braingym?schema=public
   ```
5. **Encryption key:** aws/secretsmanager (default)
6. Click **Next**
7. **Secret name:** `braingym/staging/database-url`
8. Click **Next** → **Next** → **Store**

### Step 5.2 — Store JWT Secret

1. **Store a new secret** → Other type → Plaintext
2. Generate a random value:
   - Open your terminal: `openssl rand -base64 32` → copy output
   - Paste it as the secret value
3. **Secret name:** `braingym/staging/jwt-secret`
4. Click through → **Store**

### Step 5.3 — Store JWT Refresh Secret

Same as above:
- **Secret name:** `braingym/staging/jwt-refresh-secret`
- Value: another `openssl rand -base64 32` output

### Step 5.4 — Store LLM Encryption Secret

Same as above:
- **Secret name:** `braingym/staging/llm-encryption-secret`
- Value: another `openssl rand -base64 32` output

### Step 5.5 — Verify all secrets

Go to **Secrets Manager** → **Secrets**. You should see:
- `braingym/staging/database-url`
- `braingym/staging/jwt-secret`
- `braingym/staging/jwt-refresh-secret`
- `braingym/staging/llm-encryption-secret`

> **Note the full ARN** of each secret — you'll need them for the ECS task definition.

---

## PART 6 — ECR Repository

1. Go to **ECR** → **Repositories** → **Create repository**
2. Fill in:
   - **Visibility:** Private
   - **Repository name:** `braingym-backend`
   - **Image tag mutability:** Mutable
   - **Image scan settings:** Scan on push ✅
   - **Encryption:** AES-256 (default)
3. Click **Create repository**
4. Note the **repository URI** (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com/braingym-backend`)

---

## PART 7 — IAM Roles

### Step 7.1 — ECS Task Execution Role

This role allows ECS to pull images from ECR and fetch secrets from Secrets Manager.

1. Go to **IAM** → **Roles** → **Create role**
2. **Trusted entity type:** AWS service
3. **Use case:** Elastic Container Service → **Elastic Container Service Task**
4. Click **Next**
5. **Permissions policies:** search and attach:
   - `AmazonECSTaskExecutionRolePolicy`
6. Click **Next**
7. **Role name:** `ecsTaskExecutionRole`
8. Click **Create role**

**Add Secrets Manager permission:**
1. Click on `ecsTaskExecutionRole`
2. **Add permissions** → **Create inline policy**
3. Switch to **JSON** tab, paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:braingym/staging/*"
       }
     ]
   }
   ```
   *(Replace `YOUR_ACCOUNT_ID` with your 12-digit account number from top-right menu)*
4. **Policy name:** `braingym-staging-secrets`
5. Click **Create policy**

### Step 7.2 — ECS Task Role

This role is assumed by the running NestJS application itself.

1. **Create role** → AWS service → **Elastic Container Service Task**
2. **Permissions:** no managed policies needed for now
3. **Role name:** `ecsTaskRole`
4. Click **Create role**

### Step 7.3 — GitHub Actions Deploy Role (OIDC)

**First — create the OIDC identity provider (one-time):**
1. Go to **IAM** → **Identity providers** → **Add provider**
2. **Provider type:** OpenID Connect
3. **Provider URL:** `https://token.actions.githubusercontent.com`
4. Click **Get thumbprint**
5. **Audience:** `sts.amazonaws.com`
6. Click **Add provider**

**Now create the deploy role:**
1. **IAM** → **Roles** → **Create role**
2. **Trusted entity type:** Web identity
3. **Identity provider:** `token.actions.githubusercontent.com`
4. **Audience:** `sts.amazonaws.com`
5. Click **Next**
6. **Permissions:** skip for now (add inline after)
7. **Role name:** `braingym-deploy-staging`
8. Click **Create role**

**Edit the trust policy:**
1. Click on `braingym-deploy-staging`
2. **Trust relationships** tab → **Edit trust policy**
3. Replace with:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:thanhpt-25/brain-gym:environment:staging"
           }
         }
       }
     ]
   }
   ```
4. Click **Update policy**

**Add deploy permissions:**
1. **Permissions** tab → **Add permissions** → **Create inline policy** → JSON:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ECR",
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:GetDownloadUrlForLayer",
           "ecr:BatchGetImage",
           "ecr:PutImage",
           "ecr:InitiateLayerUpload",
           "ecr:UploadLayerPart",
           "ecr:CompleteLayerUpload",
           "ecr:BatchCheckLayerAvailability"
         ],
         "Resource": "*"
       },
       {
         "Sid": "ECS",
         "Effect": "Allow",
         "Action": [
           "ecs:UpdateService",
           "ecs:DescribeServices",
           "ecs:DescribeTaskDefinition",
           "ecs:RegisterTaskDefinition",
           "ecs:DescribeTasks",
           "ecs:ListTasks",
           "ecs:RunTask"
         ],
         "Resource": "*"
       },
       {
         "Sid": "PassRole",
         "Effect": "Allow",
         "Action": "iam:PassRole",
         "Resource": [
           "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
           "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskRole"
         ]
       },
       {
         "Sid": "S3",
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:GetObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::braingym-staging-frontend",
           "arn:aws:s3:::braingym-staging-frontend/*"
         ]
       },
       {
         "Sid": "CloudFront",
         "Effect": "Allow",
         "Action": [
           "cloudfront:CreateInvalidation",
           "cloudfront:GetDistribution"
         ],
         "Resource": "*"
       },
       {
         "Sid": "SecretsManager",
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:braingym/staging/*"
       }
     ]
   }
   ```
   *(Replace both `YOUR_ACCOUNT_ID` occurrences)*
2. **Policy name:** `braingym-deploy-staging`
3. Click **Create policy**

> ✅ Note the **Role ARN** from the role summary page (e.g. `arn:aws:iam::123456789:role/braingym-deploy-staging`)

---

## PART 8 — ECS Cluster

1. Go to **ECS** → **Clusters** → **Create cluster**
2. **Cluster name:** `braingym-staging`
3. **Infrastructure:** AWS Fargate ✅ (check this, uncheck EC2)
4. **Monitoring:** enable Container Insights (optional but helpful)
5. Click **Create**

---

## PART 9 — Application Load Balancer

### Step 9.1 — Create Target Group

1. Go to **EC2** → **Target Groups** → **Create target group**
2. **Target type:** IP addresses
3. **Target group name:** `braingym-staging-tg`
4. **Protocol:** HTTP, **Port:** `3000`
5. **VPC:** `braingym-staging`
6. **Health check protocol:** HTTP
7. **Health check path:** `/api/v1/health`
8. **Health check interval:** 30 seconds
9. **Healthy threshold:** 2
10. **Unhealthy threshold:** 3
11. Click **Next** → **Create target group** (no targets to register yet)

### Step 9.2 — Create Load Balancer

1. Go to **EC2** → **Load Balancers** → **Create load balancer**
2. Choose **Application Load Balancer** → **Create**
3. **Load balancer name:** `braingym-staging-alb`
4. **Scheme:** Internet-facing
5. **IP address type:** IPv4
6. **VPC:** `braingym-staging`
7. **Mappings:** check both AZs → select **public subnets** for each
8. **Security groups:** remove default → add `braingym-staging-alb`
9. **Listeners and routing:**
   - Protocol: HTTP, Port: 80
   - Default action: Forward to → `braingym-staging-tg`
10. Click **Create load balancer**
11. Note the **DNS name** (e.g. `braingym-staging-alb-xxxx.us-east-1.elb.amazonaws.com`)

---

## PART 10 — CloudWatch Log Group

1. Go to **CloudWatch** → **Log groups** → **Create log group**
2. **Log group name:** `/ecs/braingym-backend`
3. **Retention setting:** 7 days
4. Click **Create**

---

## PART 11 — ECS Task Definitions

### Step 11.1 — Main service task definition

1. Go to **ECS** → **Task definitions** → **Create new task definition**
2. **Task definition family:** `braingym-backend`
3. **Launch type:** AWS Fargate
4. **Operating system/Architecture:** Linux/X86_64
5. **Task size:**
   - CPU: `0.5 vCPU`
   - Memory: `1 GB`
6. **Task execution role:** `ecsTaskExecutionRole`
7. **Task role:** `ecsTaskRole`

**Container — click "Add container":**
- **Name:** `braingym-backend`
- **Image URI:** `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/braingym-backend:latest`
- **Essential container:** Yes
- **Port mappings:** Container port `3000`, Protocol `TCP`
- **Environment variables:**
  | Key | Value type | Value |
  |-----|-----------|-------|
  | `NODE_ENV` | Value | `production` |
  | `PORT` | Value | `3000` |
  | `REDIS_HOST` | Value | `braingym-staging.xxxx.cfg.use1.cache.amazonaws.com` |
  | `REDIS_PORT` | Value | `6379` |

- **Secrets** (click "Add" for each):
  | Name | ValueFrom (paste full secret ARN) |
  |------|----------------------------------|
  | `DATABASE_URL` | `arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:braingym/staging/database-url-SUFFIX` |
  | `JWT_SECRET` | `arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:braingym/staging/jwt-secret-SUFFIX` |
  | `JWT_REFRESH_SECRET` | `arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:braingym/staging/jwt-refresh-secret-SUFFIX` |
  | `LLM_KEY_ENCRYPTION_SECRET` | `arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:braingym/staging/llm-encryption-secret-SUFFIX` |

  > ⚠️ The ARN must include the full suffix (the random 6-char suffix AWS appends). Copy it exactly from the Secrets Manager console.

- **Logging:**
  - Log driver: `awslogs`
  - awslogs-group: `/ecs/braingym-backend`
  - awslogs-region: `us-east-1`
  - awslogs-stream-prefix: `ecs`

8. Click **Create**

### Step 11.2 — Migration task definition

1. **Create new task definition** (same settings as above)
2. **Task definition family:** `braingym-backend-migrate`
3. Everything identical to `braingym-backend` EXCEPT:
   - Same container config, same secrets
   - No port mappings needed (one-off task)
4. Click **Create**

---

## PART 12 — ECS Service

1. Go to **ECS** → **Clusters** → `braingym-staging` → **Services** tab → **Create**
2. **Compute options:** Launch type → Fargate
3. **Task definition:** `braingym-backend` (latest revision)
4. **Service name:** `braingym-backend`
5. **Desired tasks:** `1`
6. **Deployment type:** Rolling update
7. **Networking:**
   - **VPC:** `braingym-staging`
   - **Subnets:** select both **private subnets**
   - **Security groups:** remove default → add `braingym-staging-ecs`
   - **Public IP:** Turned off
8. **Load balancing:**
   - **Load balancer type:** Application Load Balancer
   - **Load balancer:** `braingym-staging-alb`
   - **Container:** `braingym-backend 3000:3000`
   - **Listener:** Use an existing listener → `80:HTTP`
   - **Target group:** `braingym-staging-tg`
9. **Service auto scaling:** Off (for staging)
10. Click **Create**

> ⏳ The service will show "Provisioning" then "Pending" — it can't become healthy yet because no Docker image is pushed. That's fine — the first GitHub Actions deploy will push the image and update the service.

---

## PART 13 — S3 Bucket (Frontend)

1. Go to **S3** → **Create bucket**
2. **Bucket name:** `braingym-staging-frontend`
3. **AWS Region:** `us-east-1`
4. **Object Ownership:** ACLs disabled (recommended)
5. **Block Public Access:** leave ALL checkboxes **checked** (block everything)
6. **Versioning:** Enable *(optional but helpful for rollbacks)*
7. Click **Create bucket**

---

## PART 14 — CloudFront Distribution

1. Go to **CloudFront** → **Distributions** → **Create distribution**

### Origin 1 — S3 (frontend)
- **Origin domain:** select `braingym-staging-frontend.s3.us-east-1.amazonaws.com`
- **Origin access:** Origin access control settings (recommended)
  - Click **Create new OAC** → name `braingym-staging-oac` → **Create**
- **Origin path:** leave empty

### Default cache behavior
- **Path pattern:** Default (`*`)
- **Compress objects automatically:** Yes
- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Allowed HTTP methods:** GET, HEAD
- **Cache policy:** CachingOptimized

### Add second origin — ALB (API)
1. Scroll to **Origins** → **Add origin**
2. **Origin domain:** paste ALB DNS name (e.g. `braingym-staging-alb-xxxx.us-east-1.elb.amazonaws.com`)
3. **Protocol:** HTTP only
4. **HTTP port:** 80
5. **Origin name:** `alb-backend`

### Add cache behavior for API
1. Scroll to **Cache behaviors** → **Add behavior**
2. **Path pattern:** `/api/v1/*`
3. **Origin:** `alb-backend`
4. **Viewer protocol policy:** Redirect HTTP to HTTPS
5. **Allowed HTTP methods:** GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
6. **Cache policy:** CachingDisabled
7. **Origin request policy:** AllViewer

### Custom error responses (SPA routing)
1. Scroll to **Custom error responses** → **Add error response**
2. Add two entries:
   | HTTP error code | TTL | Response page path | HTTP response code |
   |----------------|-----|--------------------|--------------------|
   | 403 | 0 | /index.html | 200 |
   | 404 | 0 | /index.html | 200 |

### Settings
- **Price class:** Use only North America and Europe *(cheapest)*
- **Default root object:** `index.html`

8. Click **Create distribution** → takes 5-10 min to deploy globally

### Step 14.1 — Attach bucket policy for OAC

After creating the distribution:
1. CloudFront shows a banner: **"Copy policy"** — click it
2. Go to **S3** → `braingym-staging-frontend` → **Permissions** tab
3. **Bucket policy** → **Edit** → paste the copied policy → **Save changes**

### Step 14.2 — Note the distribution details

- **Distribution ID** (e.g. `E1ABC2DEF3GHI4`) — needed for GitHub secrets
- **Distribution domain name** (e.g. `d1xxxx.cloudfront.net`) — your staging URL

---

## PART 15 — GitHub Environment Secrets

1. Go to your GitHub repo: `https://github.com/thanhpt-25/brain-gym`
2. **Settings** → **Environments** → **New environment**
3. **Name:** `staging` → **Configure environment**
4. Under **Environment secrets** → **Add secret** for each:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID (top-right corner in console) |
| `AWS_ROLE_ARN` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/braingym-deploy-staging` |
| `AWS_S3_BUCKET` | `braingym-staging-frontend` |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | Distribution ID from Part 14 (e.g. `E1ABC2DEF3GHI4`) |
| `AWS_PRIVATE_SUBNET_IDS` | `subnet-cccc,subnet-dddd` (your two private subnet IDs) |
| `AWS_ECS_SECURITY_GROUP` | `sg-ecs-xxxx` (ECS security group ID from Part 2) |
| `VITE_API_BASE_URL` | `https://d1xxxx.cloudfront.net/api/v1` |
| `DEPLOYMENT_ENDPOINT` | `https://d1xxxx.cloudfront.net` |

5. No protection rules for staging (leave deployment branches as "All branches")

---

## PART 16 — First Deployment

### Step 16.1 — Push a commit to trigger the pipeline

```bash
git checkout main
git commit --allow-empty -m "chore: trigger first staging deploy"
git push origin main
```

### Step 16.2 — Watch the pipeline

1. Go to GitHub → **Actions** tab
2. Click on the running **Deploy** workflow
3. Watch each job in order:
   - **Build & Push Backend** — ~3-5 min (builds Docker image, pushes to ECR)
   - **Migrate Database** — ~2-3 min (runs `npx prisma migrate deploy` via ECS task)
   - **Deploy Backend** — ~3-5 min (updates ECS service, waits for stability)
   - **Deploy Frontend** — ~2-3 min (builds React, syncs to S3, invalidates CloudFront)
   - **Smoke Test** — ~1 min (health check on the CloudFront endpoint)

### Step 16.3 — Verify deployment

1. **Frontend:** open `https://d1xxxx.cloudfront.net` in your browser
2. **API health:** `curl https://d1xxxx.cloudfront.net/api/v1/health`
3. **ECS logs:** go to **CloudWatch** → **Log groups** → `/ecs/braingym-backend` → latest log stream
4. **ECS service:** go to **ECS** → `braingym-staging` → `braingym-backend` service → **Tasks** tab → task should be `RUNNING`

---

## Checklist Summary

| # | Step | Est. Time |
|---|------|-----------|
| 1 | Create VPC + subnets | 5 min |
| 2 | Create 4 security groups | 10 min |
| 3 | Create RDS PostgreSQL | 5 min (+10 min provisioning) |
| 4 | Create ElastiCache Redis | 5 min (+5 min provisioning) |
| 5 | Create 4 secrets in Secrets Manager | 10 min |
| 6 | Create ECR repository | 2 min |
| 7 | Create IAM roles (ecsTask*, deploy) | 15 min |
| 8 | Create ECS cluster | 2 min |
| 9 | Create ALB + target group | 10 min |
| 10 | Create CloudWatch log group | 2 min |
| 11 | Register 2 ECS task definitions | 10 min |
| 12 | Create ECS service | 5 min |
| 13 | Create S3 bucket | 3 min |
| 14 | Create CloudFront distribution | 5 min (+10 min deploy) |
| 15 | Add GitHub secrets | 5 min |
| 16 | Push commit + verify | 15 min |
| **Total** | | **~2 hours** |

---

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| ECS task fails to start | Secret ARN wrong/missing suffix | Copy ARN directly from Secrets Manager — it ends in `-xxxxxx` |
| ECS task unhealthy | `/api/v1/health` endpoint missing | Check backend logs in CloudWatch; verify app started |
| ALB returns 502 | ECS task not running or wrong port | Check ECS service events tab for errors |
| CloudFront returns S3 XML error | OAC bucket policy not applied | Re-copy policy from CloudFront and paste into S3 bucket policy |
| GitHub Actions: "Could not assume role" | OIDC trust or sub mismatch | Check `sub` in trust policy matches `repo:thanhpt-25/brain-gym:environment:staging` |
| DB connection refused | Security group not allowing ECS → RDS | Verify RDS SG allows port 5432 from ECS SG |
| Migrations fail | DATABASE_URL wrong | Test connection string manually; check RDS endpoint and password |
