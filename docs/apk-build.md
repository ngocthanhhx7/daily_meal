# Build Daily Meal APK

This builds an Android APK that points to the API at `https://api.ngocthanhhx7.site`.

## 1. Start The API On EC2

On the EC2 terminal:

```bash
sudo dnf update -y
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

Clone the repo:

```bash
git clone https://github.com/ngocthanhhx7/daily_meal.git daily_meal
cd daily_meal
npm ci
npm run build
cp server/.env.example server/.env
nano server/.env
```

Set production env values in `server/.env`:

```env
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=*
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=dailymeal123
S3_OBJECT_ACL=public-read
```

If EC2 has an IAM role with S3 access, leave AWS keys empty. Otherwise set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

Start API with PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

Run the command printed by `pm2 startup`, then test:

```bash
curl http://127.0.0.1:4000/health
```

## 2. Expose API Through Nginx

Create Nginx config:

```bash
sudo tee /etc/nginx/conf.d/daily-meal-api.conf >/dev/null <<'EOF'
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
EOF
```

Start Nginx:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
curl http://54.197.170.50/health
```

Your EC2 security group must allow inbound HTTP `80`.

## 3. Build APK With EAS

On your local machine:

```bash
cd D:\Daily_Meal_App\daily_meal
npm install
npm --workspace client run typecheck
cd client
npx eas-cli login
npx eas-cli build:configure
npm run build:apk:clean
```

The APK profile is `preview` in `client/eas.json`, and currently uses:

```env
EXPO_PUBLIC_API_URL=https://api.ngocthanhhx7.site
```

Use `build:apk:clean` after changing API URLs, native config, app icons, permissions, or Expo config. It passes `--clear-cache` to EAS so the remote build does not reuse stale cached native/bundle state.

When EAS finishes, it will print a download URL for the APK.

## 4. HTTPS Domain Checklist

Before building, verify:

```bash
curl https://api.ngocthanhhx7.site/health
```

Then confirm these files use the same API URL:

- `client/.env`
- `client/.env.production`
- `client/eas.json`

```env
EXPO_PUBLIC_API_URL=https://api.ngocthanhhx7.site
```

After HTTPS is stable, remove `usesCleartextTraffic` from `client/app.json` or set it to `false`.
