# AWS Console Setup — Step by Step

This guide walks through every click needed to deploy CertGym on AWS ECS Fargate
by hand via the AWS Management Console. Use this only if you cannot use the Terraform
path (`aws-terraform.md`). Terraform is the recommended approach — it is faster,
reproducible, and less error-prone.

**Estimated time:** 2–3 hours (plus ~15 min waiting for RDS/ElastiCache to provision).

**Region:** Use `ap-southeast-1` (Singapore) throughout unless you have a specific
reason to use a different region. Every service except the ACM certificate for
CloudFront must be in the same region. The ACM certificate must be created in `us-east-1`
regardless of where the rest of the stack lives.

---

## Overview of what you will create

```
Internet → Route53 DNS → CloudFront → S3 (React frontend)
                                    → S3 (avatars)
                                    → ALB → ECS Fargate (NestJS backend)
                                                  ↓               ↓
                                          RDS PostgreSQL   ElastiCache Redis
                                                  ↑
                                          Lambda (Markitdown)
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
   - **NAT gateways:** `In 1 AZ` (staging cost saving)
   - **VPC endpoints:** None
4. Click **Create VPC** → wait ~2 minutes

> This creates: 1 VPC, 2 public subnets, 2 private subnets, 1 internet gateway,
> 1 NAT gateway, and route tables automatically.

### Step 1.2 — Note your subnet and VPC IDs

1. Go to **VPC** → **Subnets**
2. Filter by your VPC name `braingym-staging`
3. Note these IDs (you will need them later):
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
   - **Description:** `Security group for ALB`
   - **VPC:** select `braingym-staging`
3. **Inbound rules** → Add rules:
   - Type: `HTTP`, Port: `80`, Source: `0.0.0.0/0`
   - Type: `HTTPS`, Port: `443`, Source: `0.0.0.0/0`
4. **Outbound rules:** leave default (All traffic)
5. Click **Create security group** → note the **SG ID** (e.g. `sg-alb-xxxx`)

### Step 2.2 — Security Group for ECS

1. **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-ecs`
   - **Description:** `Security group for ECS tasks`
   - **VPC:** `braingym-staging`
3. **Inbound rules** → Add rule:
   - Type: `Custom TCP`, Port: `3000`, Source: select `braingym-staging-alb` security group
4. Click **Create security group** → note the **SG ID** (e.g. `sg-ecs-xxxx`)

### Step 2.3 — Security Group for RDS

1. **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-rds`
   - **Description:** `Security group for RDS`
   - **VPC:** `braingym-staging`
3. **Inbound rules** → Add rule:
   - Type: `PostgreSQL`, Port: `5432`, Source: select `braingym-staging-ecs` security group
4. Click **Create security group**

### Step 2.4 — Security Group for ElastiCache

1. **Create security group**
2. Fill in:
   - **Name:** `braingym-staging-redis`
   - **Description:** `Security group for ElastiCache`
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
5. **Templates:** Dev/Test (staging)
6. **Settings:**
   - **DB instance identifier:** `braingym-staging`
   - **Master username:** `braingym`
   - **Credentials management:** Self managed → generate a strong password and **copy it**
7. **Instance configuration:**
   - **DB instance class:** `db.t3.micro` (staging)
8. **Storage:**
   - **Storage type:** `gp3`
   - **Allocated storage:** `20 GB`
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
    - **Backup window:** `03:00–04:00 UTC`
    - **Maintenance window:** `Monday 04:00–05:00 UTC`
12. Click **Create database** → takes ~10 min to provision

> Continue with later steps while RDS provisions.

### Step 3.3 — Note RDS endpoint

After RDS is available:
1. Click on `braingym-staging` database
2. Under **Connectivity & security** → copy the **Endpoint** (e.g. `braingym-staging.xxxx.ap-southeast-1.rds.amazonaws.com`)
3. Your `DATABASE_URL` will be:
   ```
   postgresql://braingym:PASSWORD@braingym-staging.xxxx.ap-southeast-1.rds.amazonaws.com:5432/braingym?schema=public
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

### Step 4.2 — Create Redis Replication Group

1. Go to **ElastiCache** → **Redis OSS caches** → **Create Redis OSS cache**
2. **Deployment option:** Design your own cache
3. **Creation method:** Standard create
4. Fill in:
   - **Cluster mode:** Disabled (staging)
   - **Name:** `braingym-staging`
   - **Engine version:** `7.0`
   - **Port:** `6379`
   - **Node type:** `cache.t3.micro`
   - **Number of replicas:** `0` (staging — use 1+ for production to enable automatic failover)
5. **Subnet group:** `braingym-staging`
6. **Security groups:** remove default → add `braingym-staging-redis`
7. **Encryption at rest:** Enable
8. **Encryption in transit:** Leave **disabled** (the app currently connects with plain REDIS_HOST/PORT; enable only after the backend supports TLS + AUTH)
9. Click **Create** → takes ~5 min

### Step 4.3 — Note Redis endpoint

After available:
1. Click on `braingym-staging`
2. Copy the **Primary endpoint** (e.g. `braingym-staging.xxxx.ng.0001.apse1.cache.amazonaws.com:6379`)
3. Note the host and port separately — they are set as `REDIS_HOST` and `REDIS_PORT` environment variables in the ECS task definition

---

## PART 5 — Secrets Manager

### Step 5.1 — Store DATABASE_URL

1. Go to **Secrets Manager** → **Store a new secret**
2. **Secret type:** Other type of secret
3. Switch to **Plaintext** tab
4. Paste your full DATABASE_URL:
   ```
   postgresql://braingym:YOUR_PASSWORD@braingym-staging.xxxx.ap-southeast-1.rds.amazonaws.com:5432/braingym?schema=public
   ```
5. Click **Next**
6. **Secret name:** `braingym/staging/database-url`
7. Click **Next** → **Next** → **Store**

### Step 5.2 — Store JWT Secret

1. **Store a new secret** → Other type → Plaintext
2. Generate a random value: `openssl rand -base64 32` → paste the output
3. **Secret name:** `braingym/staging/jwt-secret`
4. Click through → **Store**

### Step 5.3 — Store JWT Refresh Secret

Same as above:
- **Secret name:** `braingym/staging/jwt-refresh-secret`
- Value: a fresh `openssl rand -base64 32` output

### Step 5.4 — Store LLM Encryption Secret

Same as above:
- **Secret name:** `braingym/staging/llm-encryption-secret`
- Value: a fresh `openssl rand -base64 32` output

### Step 5.5 — Verify all secrets

Go to **Secrets Manager** → **Secrets**. You should see:
- `braingym/staging/database-url`
- `braingym/staging/jwt-secret`
- `braingym/staging/jwt-refresh-secret`
- `braingym/staging/llm-encryption-secret`

> Note the **full ARN** of each secret — you will need them for the ECS task definition.
> ARNs include a random 6-character suffix appended by AWS (e.g. `…/database-url-AbCdEf`).

---

## PART 6 — ECR Repositories

### Step 6.1 — Backend repository

1. Go to **ECR** → **Repositories** → **Create repository**
2. Fill in:
   - **Visibility:** Private
   - **Repository name:** `braingym-backend`
   - **Image tag mutability:** Mutable
   - **Scan on push:** Enable
   - **Encryption:** KMS
3. Click **Create repository**
4. Note the **repository URI** (e.g. `123456789.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-backend`)

### Step 6.2 — Markitdown Lambda repository

1. **Create repository**
2. Fill in:
   - **Repository name:** `braingym-markitdown`
   - **Image tag mutability:** Mutable
   - **Scan on push:** Enable
   - **Encryption:** KMS
3. Click **Create repository**
4. Note the **repository URI** (e.g. `123456789.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-markitdown`)

---

## PART 7 — IAM Roles

### Step 7.1 — ECS Task Execution Role

This role allows ECS to pull images from ECR and fetch secrets from Secrets Manager.

1. Go to **IAM** → **Roles** → **Create role**
2. **Trusted entity type:** AWS service
3. **Use case:** Elastic Container Service → **Elastic Container Service Task**
4. Click **Next**
5. **Permissions policies:** search and attach `AmazonECSTaskExecutionRolePolicy`
6. Click **Next**
7. **Role name:** `braingym-staging-ecs-execution`
8. Click **Create role**

**Add Secrets Manager permission:**
1. Click on `braingym-staging-ecs-execution`
2. **Add permissions** → **Create inline policy** → **JSON** tab:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": "secretsmanager:GetSecretValue",
       "Resource": "arn:aws:secretsmanager:ap-southeast-1:YOUR_ACCOUNT_ID:secret:braingym/staging/*"
     }]
   }
   ```
3. **Policy name:** `secrets-manager-read`
4. Click **Create policy**

### Step 7.2 — ECS Task Role

This role is assumed by the running NestJS application to access S3 and Lambda.

1. **Create role** → AWS service → **Elastic Container Service Task**
2. **Role name:** `braingym-staging-ecs-task`
3. Click **Create role**

**Add S3 avatars permission:**
1. Click on `braingym-staging-ecs-task`
2. **Add permissions** → **Create inline policy** → **JSON** tab:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "AvatarsBucket",
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::braingym-staging-avatars/*"
     }]
   }
   ```
3. **Policy name:** `s3-avatars`

**Add Markitdown Lambda permission:**
1. **Add permissions** → **Create inline policy** → **JSON** tab:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "MaterialsTmpBucket",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::braingym-staging-materials-tmp/*"
       },
       {
         "Sid": "InvokeMarkitdownLambda",
         "Effect": "Allow",
         "Action": ["lambda:InvokeFunction"],
         "Resource": "arn:aws:lambda:ap-southeast-1:YOUR_ACCOUNT_ID:function:braingym-staging-markitdown"
       }
     ]
   }
   ```
2. **Policy name:** `markitdown-pipeline`

### Step 7.3 — GitHub Actions Deploy Role (OIDC)

**Create the OIDC identity provider (one-time per account):**
1. Go to **IAM** → **Identity providers** → **Add provider**
2. **Provider type:** OpenID Connect
3. **Provider URL:** `https://token.actions.githubusercontent.com`
4. Click **Get thumbprint**
5. **Audience:** `sts.amazonaws.com`
6. Click **Add provider**

**Create the deploy role:**
1. **IAM** → **Roles** → **Create role**
2. **Trusted entity type:** Web identity
3. **Identity provider:** `token.actions.githubusercontent.com`
4. **Audience:** `sts.amazonaws.com`
5. Click **Next** → skip permissions for now
6. **Role name:** `braingym-deploy-staging`
7. Click **Create role**

**Edit the trust policy:**
1. Click on `braingym-deploy-staging` → **Trust relationships** → **Edit trust policy**
2. Replace with:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
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
     }]
   }
   ```
3. Click **Update policy**

**Add deploy permissions:**
1. **Permissions** tab → **Add permissions** → **Create inline policy** → **JSON** tab:
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
         "Sid": "Lambda",
         "Effect": "Allow",
         "Action": ["lambda:UpdateFunctionCode", "lambda:GetFunction"],
         "Resource": "arn:aws:lambda:ap-southeast-1:YOUR_ACCOUNT_ID:function:braingym-staging-markitdown"
       },
       {
         "Sid": "PassRole",
         "Effect": "Allow",
         "Action": "iam:PassRole",
         "Resource": [
           "arn:aws:iam::YOUR_ACCOUNT_ID:role/braingym-staging-ecs-execution",
           "arn:aws:iam::YOUR_ACCOUNT_ID:role/braingym-staging-ecs-task"
         ]
       },
       {
         "Sid": "S3Frontend",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket"],
         "Resource": [
           "arn:aws:s3:::braingym-staging-frontend",
           "arn:aws:s3:::braingym-staging-frontend/*"
         ]
       },
       {
         "Sid": "CloudFront",
         "Effect": "Allow",
         "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetDistribution"],
         "Resource": "*"
       },
       {
         "Sid": "SecretsManager",
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": "arn:aws:secretsmanager:ap-southeast-1:YOUR_ACCOUNT_ID:secret:braingym/staging/*"
       }
     ]
   }
   ```
2. **Policy name:** `braingym-deploy-staging`
3. Click **Create policy**

> Note the **Role ARN** from the role summary page (e.g. `arn:aws:iam::123456789:role/braingym-deploy-staging`)

---

## PART 8 — Lambda Execution Role

1. Go to **IAM** → **Roles** → **Create role**
2. **Trusted entity type:** AWS service
3. **Use case:** Lambda
4. Attach managed policy: `AWSLambdaBasicExecutionRole`
5. **Role name:** `braingym-staging-lambda-markitdown`
6. Click **Create role**

**Add S3 read permission for materials-tmp:**
1. Click on `braingym-staging-lambda-markitdown`
2. **Add permissions** → **Create inline policy** → **JSON** tab:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "ReadMaterialsTmp",
       "Effect": "Allow",
       "Action": ["s3:GetObject"],
       "Resource": "arn:aws:s3:::braingym-staging-materials-tmp/*"
     }]
   }
   ```
3. **Policy name:** `read-materials-tmp`

---

## PART 9 — ECS Cluster

1. Go to **ECS** → **Clusters** → **Create cluster**
2. **Cluster name:** `braingym-staging`
3. **Infrastructure:** AWS Fargate (check this; uncheck EC2)
4. **Monitoring:** enable Container Insights
5. Click **Create**

---

## PART 10 — Application Load Balancer

### Step 10.1 — Create Target Group

1. Go to **EC2** → **Target Groups** → **Create target group**
2. **Target type:** IP addresses
3. **Target group name:** `braingym-staging`
4. **Protocol:** HTTP, **Port:** `3000`
5. **VPC:** `braingym-staging`
6. **Health check protocol:** HTTP
7. **Health check path:** `/api/v1/health`
8. **Health check interval:** 30 seconds
9. **Healthy threshold:** 2
10. **Unhealthy threshold:** 3
11. **Timeout:** 5 seconds
12. **Deregistration delay:** 30 seconds
13. Click **Next** → **Create target group** (no targets to register yet)

### Step 10.2 — Create Load Balancer

1. Go to **EC2** → **Load Balancers** → **Create load balancer**
2. Choose **Application Load Balancer** → **Create**
3. **Load balancer name:** `braingym-staging`
4. **Scheme:** Internet-facing
5. **IP address type:** IPv4
6. **VPC:** `braingym-staging`
7. **Mappings:** check both AZs → select **public subnets** for each
8. **Security groups:** remove default → add `braingym-staging-alb`
9. **Listeners and routing:**
   - Protocol: HTTP, Port: 80
   - Default action: Forward to → `braingym-staging`
10. Click **Create load balancer**
11. Note the **DNS name** (e.g. `braingym-staging-xxxx.ap-southeast-1.elb.amazonaws.com`)

---

## PART 11 — CloudWatch Log Groups

1. Go to **CloudWatch** → **Log groups** → **Create log group**
2. **Log group name:** `/ecs/braingym-backend`
3. **Retention setting:** 7 days (staging)
4. Click **Create**

Repeat for the Lambda log group:
1. **Create log group**
2. **Log group name:** `/aws/lambda/braingym-staging-markitdown`
3. **Retention setting:** 14 days
4. Click **Create**

---

## PART 12 — S3 Buckets

### Step 12.1 — Frontend bucket

1. Go to **S3** → **Create bucket**
2. **Bucket name:** `braingym-staging-frontend`
3. **AWS Region:** `ap-southeast-1`
4. **Object Ownership:** ACLs disabled
5. **Block Public Access:** leave ALL checkboxes **checked**
6. **Versioning:** Enable
7. **Encryption:** Server-side encryption with Amazon S3 managed keys (SSE-S3)
8. Click **Create bucket**

### Step 12.2 — Avatars bucket

1. **Create bucket**
2. **Bucket name:** `braingym-staging-avatars`
3. **AWS Region:** `ap-southeast-1`
4. **Block Public Access:** leave ALL checkboxes **checked**
5. **Encryption:** SSE-S3
6. Click **Create bucket**

**Add CORS configuration for presigned PUT URLs:**
1. Click on `braingym-staging-avatars` → **Permissions** → **Cross-origin resource sharing (CORS)**
2. Click **Edit** and paste:
   ```json
   [
     {
       "AllowedHeaders": ["Content-Type", "Content-Length"],
       "AllowedMethods": ["PUT"],
       "AllowedOrigins": [
         "https://brain-gym.biz",
         "https://www.brain-gym.biz"
       ],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
3. Click **Save changes**

### Step 12.3 — Materials temp bucket

1. **Create bucket**
2. **Bucket name:** `braingym-staging-materials-tmp`
3. **AWS Region:** `ap-southeast-1`
4. **Block Public Access:** leave ALL checkboxes **checked**
5. **Encryption:** SSE-S3
6. Click **Create bucket**

**Add lifecycle rule to auto-delete after 24 hours:**
1. Click on `braingym-staging-materials-tmp` → **Management** → **Create lifecycle rule**
2. **Rule name:** `auto-delete-after-24h`
3. **Filter:** Prefix `uploads/`
4. **Lifecycle rule actions:** Expire current versions after `1` day
5. Click **Create rule**

---

## PART 13 — Lambda Function

### Step 13.1 — Create the Lambda function

Before creating the Lambda, you need to push a bootstrap image to the `braingym-markitdown` ECR repository:

```bash
# Authenticate to ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com

# Build and push the Markitdown image
docker build \
  -t YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-markitdown:latest \
  ./lambda/markitdown
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-markitdown:latest
```

Then in the console:
1. Go to **Lambda** → **Functions** → **Create function**
2. **Author from scratch** — but scroll down and select **Container image**
3. **Function name:** `braingym-staging-markitdown`
4. **Container image URI:** click **Browse images** → select the `braingym-markitdown` repository → choose `latest`
5. **Architecture:** x86_64
6. **Permissions:** Use an existing role → `braingym-staging-lambda-markitdown`
7. Click **Create function**

**Update configuration:**
1. Click on `braingym-staging-markitdown` → **Configuration** → **General configuration** → **Edit**
2. **Memory:** `1024 MB`
3. **Timeout:** `5 min 0 sec`
4. Click **Save**

**Add environment variable:**
1. **Configuration** → **Environment variables** → **Edit** → **Add environment variable**
2. Key: `AWS_REGION_NAME`, Value: `ap-southeast-1`
3. Click **Save**

---

## PART 14 — CloudFront Distribution

### Step 14.1 — Create the distribution

1. Go to **CloudFront** → **Distributions** → **Create distribution**

**Origin 1 — S3 frontend:**
- **Origin domain:** select `braingym-staging-frontend.s3.ap-southeast-1.amazonaws.com`
- **Origin access:** Origin access control settings (recommended)
  - Click **Create new OAC** → name `braingym-staging-oac` → **Create**

**Origin 2 — S3 avatars:**
1. Scroll to **Origins** → **Add origin**
2. **Origin domain:** select `braingym-staging-avatars.s3.ap-southeast-1.amazonaws.com`
3. **Origin access:** Origin access control settings
   - Click **Create new OAC** → name `braingym-staging-avatars-oac` → **Create**
4. **Origin name:** `s3-avatars`

**Origin 3 — ALB (backend API):**
1. **Add origin**
2. **Origin domain:** paste the ALB DNS name (e.g. `braingym-staging-xxxx.ap-southeast-1.elb.amazonaws.com`)
3. **Protocol:** HTTP only
4. **HTTP port:** 80
5. **Origin name:** `alb-backend`

**Default cache behavior (S3 frontend):**
- **Path pattern:** Default (`*`)
- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Allowed HTTP methods:** GET, HEAD, OPTIONS
- **Cache policy:** CachingOptimized
- **Compress objects automatically:** Yes

**Cache behavior for avatars:**
1. **Cache behaviors** → **Add behavior**
2. **Path pattern:** `/avatars/*`
3. **Origin:** `s3-avatars`
4. **Viewer protocol policy:** Redirect HTTP to HTTPS
5. **Allowed HTTP methods:** GET, HEAD
6. **Cache policy:** CachingOptimized

**Cache behavior for API:**
1. **Add behavior**
2. **Path pattern:** `/api/v1/*`
3. **Origin:** `alb-backend`
4. **Viewer protocol policy:** Redirect HTTP to HTTPS
5. **Allowed HTTP methods:** GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
6. **Cache policy:** CachingDisabled
7. **Origin request policy:** AllViewer (or create a custom policy forwarding `Authorization`, `Content-Type`, `Origin`, `Accept` headers)

**Custom error responses (SPA routing):**
1. **Custom error responses** → **Add error response**
2. Add two entries:

| HTTP error code | Error caching min TTL | Response page path | HTTP response code |
|---|---|---|---|
| 403 | 0 | /index.html | 200 |
| 404 | 0 | /index.html | 200 |

**Settings:**
- **Price class:** Use only North America and Europe (cheapest)
- **Default root object:** `index.html`
- **Alternate domain names (CNAMEs):** `brain-gym.biz` and `www.brain-gym.biz`
- **Custom SSL certificate:** select the ACM certificate you created for `brain-gym.biz` (must be in `us-east-1`)
- **Security policy:** TLSv1.2_2021

Click **Create distribution** → takes 5–10 min to deploy globally.

### Step 14.2 — Attach bucket policies for OAC

After creating the distribution:

**Frontend bucket:**
1. CloudFront shows a banner: **"Copy policy"** → click it
2. Go to **S3** → `braingym-staging-frontend` → **Permissions** → **Bucket policy** → **Edit**
3. Paste the copied policy → **Save changes**

**Avatars bucket:**
1. Go to **CloudFront** → your distribution → **Origins** → select `s3-avatars` → **Edit**
2. Under **Origin access**, copy the OAC policy for the avatars bucket
3. Go to **S3** → `braingym-staging-avatars` → **Permissions** → **Bucket policy** → **Edit**
4. Paste the policy → **Save changes**

### Step 14.3 — Note the distribution details

- **Distribution ID** (e.g. `E1ABC2DEF3GHI4`) — needed for GitHub secrets
- **Distribution domain name** (e.g. `d1xxxx.cloudfront.net`) — your staging URL until DNS propagates

---

## PART 15 — ACM Certificate (for custom domain)

> The ACM certificate for CloudFront must be created in `us-east-1` even if your stack is in a different region.

1. Switch your console region to **US East (N. Virginia) — us-east-1**
2. Go to **Certificate Manager** → **Request certificate**
3. **Certificate type:** Public certificate
4. **Domain names:** `brain-gym.biz` and `www.brain-gym.biz`
5. **Validation method:** DNS validation
6. Click **Request**
7. On the certificate detail page, click **Create records in Route 53** (requires the Route53 hosted zone to exist first — see Part 16)
8. Wait for status to change to **Issued** (~5 min after DNS validation records propagate)

After the certificate is issued, return to the CloudFront distribution and add it as the custom SSL certificate.

---

## PART 16 — Route53 Hosted Zone & DNS

### Step 16.1 — Create hosted zone

1. Go to **Route 53** → **Hosted zones** → **Create hosted zone**
2. **Domain name:** `brain-gym.biz`
3. **Type:** Public hosted zone
4. Click **Create hosted zone**
5. Note the four **NS (Name Server)** records listed

### Step 16.2 — Update registrar nameservers

Log in to the domain registrar where `brain-gym.biz` is registered and replace the nameservers with the four Route53 NS values. DNS propagation typically takes 5–30 minutes.

### Step 16.3 — Add alias records for CloudFront

1. Go to **Route 53** → **Hosted zones** → `brain-gym.biz` → **Create record**
2. **Record name:** (leave empty for apex)
3. **Record type:** A
4. **Alias:** Yes
5. **Route traffic to:** Alias to CloudFront distribution → select your distribution
6. Click **Create records**

Repeat for:
- `www.brain-gym.biz` → A alias → same CloudFront distribution
- `brain-gym.biz` → AAAA alias → same CloudFront distribution
- `www.brain-gym.biz` → AAAA alias → same CloudFront distribution

---

## PART 17 — ECS Task Definitions

### Step 17.1 — Main service task definition

1. Go to **ECS** → **Task definitions** → **Create new task definition**
2. **Task definition family:** `braingym-backend`
3. **Launch type:** AWS Fargate
4. **Operating system/Architecture:** Linux/X86_64
5. **Task size:**
   - CPU: `0.5 vCPU`
   - Memory: `1 GB`
6. **Task execution role:** `braingym-staging-ecs-execution`
7. **Task role:** `braingym-staging-ecs-task`

**Container — click "Add container":**
- **Name:** `braingym-backend`
- **Image URI:** `YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-backend:latest`
- **Essential container:** Yes
- **Port mappings:** Container port `3000`, Protocol `TCP`

- **Environment variables:**

| Key | Value type | Value |
|-----|-----------|-------|
| `NODE_ENV` | Value | `production` |
| `PORT` | Value | `3000` |
| `REDIS_HOST` | Value | `<ElastiCache primary endpoint host>` |
| `REDIS_PORT` | Value | `6379` |
| `CORS_ORIGINS` | Value | `https://brain-gym.biz,https://www.brain-gym.biz,https://<cloudfront-domain>` |
| `AWS_REGION` | Value | `ap-southeast-1` |
| `AWS_S3_AVATARS_BUCKET` | Value | `braingym-staging-avatars` |
| `AWS_AVATARS_CDN_BASE_URL` | Value | `https://brain-gym.biz` |
| `AWS_S3_MATERIALS_TMP_BUCKET` | Value | `braingym-staging-materials-tmp` |
| `AWS_MARKITDOWN_LAMBDA_ARN` | Value | `<markitdown Lambda ARN from Part 13>` |
| `DDS_SHADOW_MODE` | Value | `false` |

- **Secrets** (paste the full secret ARN including the 6-char suffix):

| Name | ValueFrom |
|------|----------|
| `DATABASE_URL` | `arn:aws:secretsmanager:ap-southeast-1:ACCOUNT:secret:braingym/staging/database-url-SUFFIX` |
| `JWT_SECRET` | `arn:aws:secretsmanager:ap-southeast-1:ACCOUNT:secret:braingym/staging/jwt-secret-SUFFIX` |
| `JWT_REFRESH_SECRET` | `arn:aws:secretsmanager:ap-southeast-1:ACCOUNT:secret:braingym/staging/jwt-refresh-secret-SUFFIX` |
| `LLM_KEY_ENCRYPTION_SECRET` | `arn:aws:secretsmanager:ap-southeast-1:ACCOUNT:secret:braingym/staging/llm-encryption-secret-SUFFIX` |

> The ARN must include the full suffix AWS appends (the random 6-char suffix after the last `-`).
> Copy it exactly from the Secrets Manager console.

- **Logging:**
  - Log driver: `awslogs`
  - `awslogs-group`: `/ecs/braingym-backend`
  - `awslogs-region`: `ap-southeast-1`
  - `awslogs-stream-prefix`: `ecs`

8. Click **Create**

### Step 17.2 — Migration task definition

1. **Create new task definition**
2. **Task definition family:** `braingym-backend-migrate`
3. **Task size, execution role, and task role:** identical to `braingym-backend`
4. **Container name:** `braingym-backend`
5. **Image URI:** same as above (`:latest` for bootstrap)
6. **No port mappings** (one-off task)
7. **Environment variables:** only `NODE_ENV = production`
8. **Secrets:** only `DATABASE_URL` (JWT/LLM secrets not needed for migrations)
9. **Logging:** same log group, but `awslogs-stream-prefix`: `migrate`
10. Click **Create**

---

## PART 18 — ECS Service

1. Go to **ECS** → **Clusters** → `braingym-staging` → **Services** tab → **Create**
2. **Compute options:** Launch type → FARGATE
3. **Task definition:** `braingym-backend` (latest revision)
4. **Service name:** `braingym-backend`
5. **Desired tasks:** `1`
6. **Deployment type:** Rolling update
7. **Minimum healthy percent:** `50`
8. **Maximum percent:** `200`
9. **Circuit breaker:** Enable with rollback
10. **Networking:**
    - **VPC:** `braingym-staging`
    - **Subnets:** select both **private subnets**
    - **Security groups:** remove default → add `braingym-staging-ecs`
    - **Public IP:** Turned off
11. **Load balancing:**
    - **Load balancer type:** Application Load Balancer
    - **Load balancer:** `braingym-staging`
    - **Container:** `braingym-backend 3000:3000`
    - **Listener:** Use an existing listener → `80:HTTP`
    - **Target group:** `braingym-staging`
12. **Service auto scaling:** Off (staging)
13. Click **Create**

> The service will show "Provisioning" then "Pending". It cannot become healthy until a
> Docker image is pushed to ECR. The first GitHub Actions deploy will push the image
> and update the service.

---

## PART 19 — GitHub Environment Secrets

1. Go to `https://github.com/thanhpt-25/brain-gym`
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
| `VITE_API_BASE_URL` | `https://brain-gym.biz/api/v1` |
| `DEPLOYMENT_ENDPOINT` | `https://brain-gym.biz` |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth client ID |

5. No protection rules for staging (leave deployment branches as "All branches")

---

## PART 20 — First Deployment

### Step 20.1 — Push a commit to trigger the pipeline

```bash
git checkout main
git commit --allow-empty -m "chore: trigger first staging deploy"
git push origin main
```

### Step 20.2 — Watch the pipeline

1. Go to GitHub → **Actions** tab
2. Click on the running **Deploy** workflow
3. Watch each job in order:
   - **Build & Push Backend** (~3–5 min) — builds Docker image, pushes to ECR `braingym-backend`
   - **Build & Push Markitdown Lambda** (~3–5 min) — builds Lambda image, pushes to ECR `braingym-markitdown`, updates Lambda function
   - **Migrate Database** (~2–3 min) — runs `prisma migrate deploy` via one-off ECS task
   - **Deploy Backend** (~3–5 min) — updates ECS service, waits for stability
   - **Deploy Frontend** (~2–3 min) — builds React, syncs to S3, invalidates CloudFront
   - **Smoke Test** (~1 min) — health check on `DEPLOYMENT_ENDPOINT/api/v1/health`

### Step 20.3 — Verify deployment

1. **Frontend:** open `https://brain-gym.biz` in your browser (or the CloudFront domain before DNS propagates)
2. **API health:** `curl https://brain-gym.biz/api/v1/health`
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
| 6 | Create 2 ECR repositories | 5 min |
| 7 | Create IAM roles (ecs-execution, ecs-task, lambda, deploy) | 20 min |
| 8 | Create ECS cluster | 2 min |
| 9 | Create ALB + target group | 10 min |
| 10 | Create 2 CloudWatch log groups | 3 min |
| 11 | Create 3 S3 buckets | 5 min |
| 12 | Push Markitdown image + create Lambda | 10 min |
| 13 | Create CloudFront distribution | 5 min (+10 min deploy) |
| 14 | Create ACM certificate (us-east-1) | 3 min (+DNS validation) |
| 15 | Create Route53 hosted zone + DNS records | 5 min |
| 16 | Register 2 ECS task definitions | 10 min |
| 17 | Create ECS service | 5 min |
| 18 | Add GitHub secrets | 5 min |
| 19 | Push commit + verify | 15 min |
| **Total** | | **~2–3 hours** |

---

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| ECS task fails to start | Secret ARN wrong or missing suffix | Copy ARN directly from Secrets Manager — it ends in `-xxxxxx` |
| ECS task unhealthy | `/api/v1/health` returns non-200 | Check backend logs in CloudWatch; verify app started correctly |
| ALB returns 502 | ECS task not running or wrong port | Check ECS service Events tab for errors |
| CloudFront returns S3 XML error | OAC bucket policy not applied | Re-copy policy from CloudFront and paste into S3 bucket policy |
| GitHub Actions `Could not assume role` | OIDC trust or sub mismatch | Verify `sub` in trust policy matches `repo:thanhpt-25/brain-gym:environment:staging` exactly |
| DB connection refused | Security group not allowing ECS → RDS | Verify RDS SG allows port 5432 from ECS SG |
| Migrations fail | DATABASE_URL wrong | Test the connection string manually; check RDS endpoint and password |
| Lambda update rejected | OCI image format not supported | Build with `provenance: false` and `oci-mediatypes: false` — the deploy workflow already does this |
| ACM certificate stuck Pending | Registrar nameservers not updated | Update nameservers at your registrar to the Route53 NS values; wait for propagation |
