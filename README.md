# 🎓 AMG — Корпоративная платформа тестирования и оценки персонала

Полнофункциональная корпоративная платформа тестирования и сертификации сотрудников со строгой ролевой моделью (RBAC), гибридной оценкой (автоматическая + ручная проверка открытых вопросов администратором), управлением жизненным циклом тестов (черновики/публикация), назначением тестов сотрудникам и возможностью гостевого прохождения по публичным ссылкам.

---

## 🏗 Архитектура системы и стек технологий

```mermaid
graph TD
    Client[Браузер / Сотрудник / Админ / Гость] -->|HTTP / HTTPS Port 80/443| Nginx[Nginx Reverse Proxy]
    Nginx -->|/api/*| Backend[FastAPI Backend:8000]
    Nginx -->|/docs, /openapi.json| Backend
    Nginx -->|/* (SPA Routing)| Frontend[Frontend Nginx:80]
    Backend -->|Asyncpg SQLAlchemy 2.0| DB[(PostgreSQL 15)]
    Backend -.->|Auto Bootstrap & Seed| DB
```

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (asyncio + `asyncpg`), Alembic, Pydantic v2, `python-jose` (JWT), `passlib` / `bcrypt`.
- **Database**: PostgreSQL 15 Alpine (persistent volume `postgres_data`).
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Axios, React Router 6.
- **Infrastructure**: Docker, Docker Compose, Nginx Reverse Proxy with Gzip compression and SSL/Certbot integration.

---

## 👥 Ролевая модель доступа (RBAC)

| Роль | Полномочия и возможности |
| :--- | :--- |
| **`superadmin`** | **Полный доступ к системе**: Управление всеми пользователями, назначение администраторов, просмотр сквозной аналитики, создание и удаление любых тестов. |
| **`admin`** | **Экзаменатор и методист**: Создание и редактирование тестов (включая черновики), назначение тестов сотрудникам с дедлайнами, ручная проверка развернутых ответов (`manual_review`), генерация публичных ссылок для гостей, детальная аналитика. |
| **`employee`** | **Сотрудник**: Просмотр каталога тестов и назначенных заданий, прохождение тестирования с таймером, защита от подделки ответов (серверный скоринг), просмотр комментариев рецензента и истории сдачи. |
| **Гость** | **Прохождение без авторизации**: Сдача теста по прямой ссылке (`/t/:token`) с обязательным вводом ФИО, фиксацией результатов в общей аналитике. |

---

## 🚀 Быстрый старт (Локальная разработка)

### 1. Требования
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose v2](https://docs.docker.com/compose/)
- Git

### 2. Настройка окружения
```bash
# Клонирование репозитория
git clone <repository-url> lms
cd lms

# Копирование переменных окружения
cp .env.example .env
```

### 3. Запуск сервисов
```bash
docker compose up --build -d
```

При запуске автоматически:
1. Инициализируется PostgreSQL.
2. Создаются все таблицы базы данных с автомиграцией колонок.
3. Скрипт `seed.py` создает учетные записи администратора, тестового сотрудника и готовый аттестационный тест AMG.

### 4. Доступ к приложению
- **Веб-портал**: [http://localhost](http://localhost)
- **Документация API (Swagger)**: [http://localhost/docs](http://localhost/docs)
- **ReDoc**: [http://localhost/redoc](http://localhost/redoc)

### 🔑 Тестовые учетные данные

| Роль | Email | Пароль |
| :--- | :--- | :--- |
| **Суперадминистратор** | `admin@company.com` | `admin123` |
| **Сотрудник** | `employee@company.com` | `employee123` |

---

## 🌐 Step-by-Step VPS Deployment Guide (Clean Ubuntu Server)

Follow these instructions to deploy CorpTest onto a fresh VPS running Ubuntu 22.04 or 24.04 LTS.

### Step 1: Connect to VPS and Configure Firewall
```bash
ssh root@YOUR_SERVER_IP

# Update system packages
apt update && apt upgrade -y

# Configure UFW firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 2: Install Docker & Docker Compose
```bash
# Install required dependencies
apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Docker Compose plugin
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 3: Copy Project Files to the Server
You can either clone your Git repository or copy the directory directly via `rsync`:

**Option A (Using Git):**
```bash
cd /opt
git clone https://github.com/your-org/lms.git
cd lms
```

**Option B (Copying from your local machine with rsync):**
```bash
# Run this command on your local computer
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude '.git' ./ root@YOUR_SERVER_IP:/opt/lms/
```

### Step 4: Configure Production Environment Variables
On the server:
```bash
cd /opt/lms
cp .env.example .env
nano .env
```

Generate a secure 64-character secret key:
```bash
openssl rand -hex 32
```
Update the following values in `.env`:
- `POSTGRES_PASSWORD`: Use a strong random password.
- `DATABASE_URL`: Ensure credentials match `POSTGRES_PASSWORD`.
- `SECRET_KEY`: Paste the generated random string.
- `FIRST_SUPERADMIN_PASSWORD`: Choose a strong password for initial admin login.
- `CORS_ORIGINS`: Add your production domain (e.g. `["https://tests.yourcompany.com"]`).

### Step 5: Start the Application Containers
```bash
docker compose up --build -d
```

Check the status of all services:
```bash
docker compose ps
```

View live logs from the backend:
```bash
docker compose logs -f backend
```

Your service is now online at `http://YOUR_SERVER_IP`!

---

## 🔒 SSL / HTTPS Setup with Let's Encrypt & Certbot

### Step 1: Configure DNS
Ensure your domain name (e.g., `tests.yourcompany.com`) has an **A Record** pointing to `YOUR_SERVER_IP`.

### Step 2: Issue Certificate via Certbot
Install Certbot on the host:
```bash
apt install -y certbot

# Stop Nginx temporarily to free port 80 for the standalone verification
docker compose stop nginx

# Request certificate
certbot certonly --standalone -d tests.yourcompany.com --non-interactive --agree-tos --email admin@yourcompany.com
```

Your certificate files will be generated at `/etc/letsencrypt/live/tests.yourcompany.com/`.

### Step 3: Enable HTTPS in `nginx/default.conf`
Edit `nginx/default.conf` to redirect HTTP traffic to HTTPS and serve the SSL certificates:

```nginx
upstream backend_upstream {
    server backend:8000;
}

upstream frontend_upstream {
    server frontend:80;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tests.yourcompany.com;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name tests.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/tests.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tests.yourcompany.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 25M;

    # Gzip Compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location /api/ {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location ~ ^/(docs|redoc|openapi.json) {
        proxy_pass http://backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://frontend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Restart Nginx:
```bash
docker compose up -d nginx
```

### Step 4: Automated Certificate Renewal
Set up a monthly cron job to automatically renew certificates:
```bash
(crontab -l 2>/dev/null; echo "0 3 1 * * certbot renew --quiet --pre-hook 'docker compose -f /opt/lms/docker-compose.yml stop nginx' --post-hook 'docker compose -f /opt/lms/docker-compose.yml start nginx'") | crontab -
```

---

## 🛠 Database Backup & Restoration

### Backup
Create a compressed PostgreSQL dump:
```bash
docker compose exec -T db pg_dump -U postgres lms_db | gzip > "backup_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Restore
To restore from a backup file:
```bash
gunzip < backup_20260913_120000.sql.gz | docker compose exec -T db psql -U postgres -d lms_db
```

---

## 📂 Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (auth, users, tests, attempts)
│   │   ├── core/            # Config, security (JWT & bcrypt), database engine
│   │   ├── models/          # SQLAlchemy 2.0 async models
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   └── main.py          # FastAPI application & lifespan lifecycle
│   ├── Dockerfile           # Python 3.11-slim container
│   ├── requirements.txt     # Backend dependency pins
│   ├── entrypoint.sh        # Startup script (waits for db, seeds, starts uvicorn)
│   └── seed.py              # Superadmin, demo accounts, and test seeder
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios instance with JWT interceptors
│   │   ├── context/         # AuthContext with RBAC helpers
│   │   ├── components/      # Navbar, RoleBadge, ProtectedRoute
│   │   └── pages/
│   │       ├── employee/    # Test catalog, test room with countdown, result view
│   │       └── admin/       # Test constructor, test list, analytics, user roster
│   ├── Dockerfile           # Multi-stage build (Node 20 -> Nginx Alpine)
│   ├── nginx.conf           # Static asset caching and SPA HTML5 fallback
│   ├── package.json
│   ├── tailwind.config.js   # Corporate theme styling
│   └── vite.config.js
├── nginx/
│   └── default.conf         # Reverse proxy routing /api -> backend, / -> frontend
├── certbot/                 # Volume mounts for Let's Encrypt SSL
├── docker-compose.yml       # 4-container production topology (db, backend, frontend, nginx)
├── .env.example             # Complete environment configuration template
└── README.md                # This manual
```

---

## 🛡 Anti-Cheat Scoring Architecture

1. **Question Sanitization**: When an employee starts an assessment (`POST /api/attempts/start`), the backend invokes `TestEmployeeResponse`, strictly omitting `is_correct` flags and grading keys from the JSON response.
2. **Server-Side Evaluation**: Answers are submitted to `POST /api/attempts/:id/submit`. Scoring, time limit adherence (with network grace period), and percentage calculation happen strictly on the server.
3. **Audit Log**: Every attempt retains timestamps for `started_at` and `submitted_at`, calculating exact completion duration down to the second.
