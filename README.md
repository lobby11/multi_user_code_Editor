# Multi-User Code Editor

A real-time collaborative code editor where multiple developers can join a shared session, write code together, and see each other's changes instantly — all in the browser.

---

## Features

-  **Real-time collaboration** — Multiple users can join the same room and code together simultaneously
-  **Live sync** — Code changes are broadcast instantly to all users in the session via WebSockets
-  **Conflict-free editing** — Powered by [Yjs](https://github.com/yjs/yjs) (CRDT), so simultaneous edits from multiple users are merged automatically without conflicts
-  **Monaco Editor** — The same editor that powers VS Code, running in the browser
-  **Room-based sessions** — Users join a shared room using a Room ID
-  **Docker support** — Fully containerized for easy local and cloud deployment
-  **AWS ECR & ECS integration** — Docker images are built and pushed to Amazon ECR for cloud deployment
-  **IAM-secured** — All AWS access is gated through a dedicated IAM user with least-privilege permissions — no root account usage

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Monaco Editor |
| Backend | Node.js + Express |
| Real-time | Socket.IO + Yjs (CRDT) |
| Containerization | Docker + Docker Buildx |
| Cloud Registry | AWS ECR |
| Infrastructure | AWS VPC, Security Groups, ALB, ECS |
| Access Control | AWS IAM |

---

## Project Structure

```
multi_user_code_Editor/
 frontend/          # React app with Monaco Editor + Yjs binding
    src/
    package.json
    ...
 backend/           # Node.js + Express + Socket.IO + y-websocket server
    src/
    package.json
    ...
 Dockerfile         # Multi-stage build: React → Node server
```

---

## Prerequisites

Install these before starting:

| Tool | Download |
|---|---|
| Node.js (v18+) | https://nodejs.org |
| Docker Desktop | https://www.docker.com/products/docker-desktop |
| AWS CLI v2 | https://aws.amazon.com/cli |
| Git | https://git-scm.com |

Verify installs:

```bash
node -v
docker -v
aws --version
git --version
```

---

## Step-by-Step Setup

### Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd multi_user_code_Editor
```

---

### Step 2 — Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

---

### Step 3 — Configure Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
```

---

### Step 4 — Run Locally

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm start
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` → enter any Room ID → share it with collaborators to start coding together in real time.

---

## Docker — Build & Run

### Step 5 — Build the Docker Image

The Dockerfile uses a **multi-stage build**:
1. Stage 1 — installs frontend deps and runs `npm run build`
2. Stage 2 — copies the built output into the Node.js backend and serves it

Make sure you are in the **root of the project** (where the `Dockerfile` lives), then run:

```bash
docker build -t server .
```

>  If you get `no such file or directory: Dockerfile`, you are in the wrong folder. Navigate to the project root first.

### Step 6 — Test the Container Locally

```bash
docker run -p 4000:3000 server
```

Visit `http://localhost:4000` to confirm everything works before pushing to AWS.

---

## AWS IAM Setup

### Step 7 — Create a Dedicated IAM User (Do not use root)

Using the AWS root account for deployments is a serious security risk. Instead, create a dedicated IAM user with only the permissions this project needs.

**In AWS Console → IAM → Users → Create User:**

1. Username: `code-editor-deploy` (or any name you prefer)
2. Access type: **Programmatic access** (generates Access Key + Secret)
3. Attach these permissions policies directly:
   - `AmazonEC2ContainerRegistryFullAccess` — push/pull images to ECR
   - `AmazonECS_FullAccess` — deploy and manage ECS tasks
   - `AmazonFullAccess` — manage VPC and Security Groups and other things

4. Complete creation and **download the CSV** with your Access Key ID and Secret Access Key

>  Why IAM? IAM enforces **least privilege** — the deploy user can only access what it needs.
> Even if the credentials are ever leaked, an attacker cannot access billing, other AWS services,
> or delete your account. Root credentials have no such protection.

---

## AWS Deployment

### Step 8 — Configure AWS CLI with IAM Credentials

```bash
aws configure
```

Enter the IAM user credentials when prompted:

```
AWS Access Key ID:     <your-iam-access-key-id>
AWS Secret Access Key: <your-iam-secret-access-key>
Default region name:   ap-northeast-1
Default output format: json
```

>  Never hardcode or share credentials. Add `.env` to `.gitignore` and never commit keys to GitHub.

---

### Step 9 — Authenticate Docker with AWS ECR

```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <your-aws-account-id>.dkr.ecr.ap-northeast-1.amazonaws.com
```

Expected output:
```
Login Succeeded
```

---

### Step 10 — Tag the Image for ECR

```bash
docker tag server:latest <your-aws-account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/docker_live_code/server:latest
```

---

### Step 11 — Push the Image to ECR

```bash
docker push <your-aws-account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/docker_live_code/server:latest
```

Each layer uploads one by one. When complete you will see a digest:

```
latest: digest: sha256:xxxxxxxxxxxxxxxxxxxx size: 856
```

---

### Step 12 — Cross-Platform Build (Windows / ARM users)

>  **Windows PowerShell note:** Backslash `\` line continuation does not work in PowerShell.
> Run the full command on one line, or use the backtick `` ` `` for continuation:

```powershell
docker buildx build --platform linux/amd64 `
  -t <your-account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/docker_live_code/server:latest `
  --push .
```

Or as a single line:

```bash
docker buildx build --platform linux/amd64 -t <your-account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/docker_live_code/server:latest --push .
```

> Windows x64 users building natively can skip `--platform linux/amd64` — your machine already produces the correct architecture.

---

## AWS Infrastructure Overview

### Architecture

```
Internet
   
   
Route 53 / Custom Domain
   
   
Application Load Balancer (ALB)
   
   
ECS Cluster (Fargate)
   
   
Docker Container (pulled from ECR)
   
    React Frontend (served by Express)
    Socket.IO + Yjs Backend
```

### AWS Resources (created in this order)

| # | Resource | Purpose |
|---|---|---|
| 1 | **IAM User** | Scoped deploy credentials — no root access used |
| 2 | **ECR Repository** | Stores and versions the Docker image |
| 3 | **VPC** | Isolated private network for all resources |
| 4 | **Security Groups** | Firewall rules — open ports 80, 443, 3000 as needed |
| 5 | **ECS Cluster (Fargate)** | Runs the container without managing servers |
| 6 | **Application Load Balancer** | Exposes the app publicly and distributes traffic |
| 7 | **Route 53 / DNS** | Point a custom domain to the ALB |

### Accessing the App

After deploying, copy the **ALB DNS name** from the AWS Console and either:
- Access it directly: `http://<alb-dns-name>`
- Point a custom domain to the ALB via Route 53 or your deployment platfrom which uses dns

---

## Usage

1. Open the app in your browser
2. Enter or generate a **Room ID**
3. Share the Room ID with your collaborators
4. Everyone who joins the same Room ID edits code in real time

>  All users **must** use the same Room ID to be in the same session.

---

## What I Learned

This project was built as a hands-on learning exercise covering:

- **Docker** — Multi-stage Dockerfiles, `docker buildx` for cross-platform image builds
- **AWS IAM** — Creating scoped users with least-privilege permissions so no unauthorized access can occur even if credentials are exposed
- **AWS ECR** — Tagging and pushing Docker images to a private registry
- **AWS ECS / Fargate** — Running containers without managing servers
- **AWS Networking** — Setting up VPC, Security Groups, and an Application Load Balancer
- **Real-time communication** — Implementing Socket.IO for bidirectional event-based sync
- **Yjs / CRDTs** — Using Conflict-free Replicated Data Types to handle concurrent edits from multiple users without data loss or merge conflicts
- **Monaco Editor** — Embedding the VS Code editor in a React app and binding it to a Yjs document

---

## Notes

- Make sure relevant **ports are open** in your Security Group when deploying to the cloud (80, 443, or 3000)
- `node_modules` is excluded via `.dockerignore` — the Dockerfile runs `npm install` inside the container
- Never commit AWS credentials or `.env` files — add them to `.gitignore`

---

## AI Usage

- Used **Claude Code** to transform the basic frontend UI into a significantly improved version
- Used **Claude** to generate this README after explaining the full project, tech stack, and deployment process and adding theortical knowledge 
