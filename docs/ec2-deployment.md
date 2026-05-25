# Daily Meal API on EC2

This deploys the Express API on Amazon Linux 2023 with PM2 and Nginx.

## EC2 Console

Use the same region as S3, currently `us-east-1`.

- AMI: Amazon Linux 2023
- Instance type: `t4g.small` is fine for this app
- Key pair: keep the `.pem` file safe
- Security group inbound:
  - SSH `22` from your IP only
  - HTTP `80` from `0.0.0.0/0`
  - HTTPS `443` from `0.0.0.0/0` when you add SSL
  - TCP `4000` only for temporary debugging, otherwise keep it closed

Prefer attaching an IAM role to the EC2 instance instead of storing AWS keys in `.env`.
The role needs S3 permissions for the bucket used by uploads:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::dailymeal123/*"
    }
  ]
}
```

If `S3_OBJECT_ACL` is empty and your bucket policy handles public reads, `s3:PutObjectAcl` is not required.

## Server Setup

SSH into the instance:

```bash
ssh -i dailyApp.pem ec2-user@EC2_PUBLIC_IP
```

Install system packages:

```bash
sudo dnf update -y
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

Clone and build:

```bash
git clone YOUR_REPO_URL daily_meal
cd daily_meal
npm ci
npm run build
cp server/.env.example server/.env
nano server/.env
```

Recommended production values:

```env
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=*
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=dailymeal123
S3_OBJECT_ACL=public-read
```

If you attached an EC2 IAM role, leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty.

Start the API:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

Run the command printed by `pm2 startup`, then:

```bash
pm2 status
curl http://127.0.0.1:4000/health
```

## Nginx

Create `/etc/nginx/conf.d/daily-meal-api.conf`:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
curl http://EC2_PUBLIC_IP/health
```

## Mobile Client

Set the client API URL to the EC2 public URL:

```env
EXPO_PUBLIC_API_URL=http://EC2_PUBLIC_IP
```

For production, use a domain and HTTPS, then set:

```env
EXPO_PUBLIC_API_URL=https://api.your-domain.com
```

## Updates

Deploy new code:

```bash
cd ~/daily_meal
git pull
npm ci
npm run build
pm2 restart daily-meal-api
pm2 logs daily-meal-api
```
