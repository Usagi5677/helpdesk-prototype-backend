# Helpdesk Prototype Backend

This repository contains the **backend** of the Helpdesk system, facilitating efficient ticket management within company departments.

## 🚀 Features

- **Built with:** NestJS + TypeScript
- **API:** Apollo GraphQL
- **Database:** Prisma ORM with PostgreSQL
- **Caching & Real-time Notifications:** Redis
- **Role-based Access Control:** Admins can assign roles to users
- **Ticket Management:**
  - Create tickets with descriptions, priorities, attachments, and chat logs
  - Support staff updates ticket status and resolves issues
  - Users can **rate support performance** (1-5 stars)
- **Filtering & Dashboard:**
  - Filter tickets by status, priority, date, etc.
  - View summary stats via dashboard
- **User & Group Management:**
  - Create user groups
  - Manage departments and ticket categories
- **Checklists:** Track progress with checklist items inside a ticket

---

## 🎯 Live Demo  
🔗 [Live Demo Link](#) _(If hosted, replace with the actual URL)_

---

## 🏆 My Role  

I developed the **backend** of this system using **NestJS + TypeScript**.  
Key contributions:
- Built GraphQL API using **Apollo Server**
- Designed **PostgreSQL database schema** with **Prisma ORM**
- Implemented **real-time notifications** using **Redis + GraphQL subscriptions**
- Developed **role-based access control** (RBAC)
- Created API endpoints for managing **tickets, users, departments, and categories**
- Set up **filtering and dashboard** logic

---

## 🛠 Setup & Installation

### **1️⃣ Clone the Repository**

```sh
git clone https://github.com/Usagi5677/helpdesk-prototype-backend.git
cd helpdesk-prototype-backend
```

### **2️⃣ Install Dependencies**
```sh
npm install
```

### **3️⃣ Set Up Environment Variables**

Create a .env file in the root directory with the following variables:
```sh
DATABASE_URL=postgresql://user:password@localhost:5432/helpdesk
REDIS_URL=redis://localhost:6379
PORT=4000
```
Replace user and password with your PostgreSQL credentials.

### **4️⃣ Apply Database Migrations**
```sh
npx prisma migrate deploy
```
### **5️⃣ Start the Development Server**
```sh
npm run start:dev
```
The server will run at http://localhost:4000.


## 📌 Notes

- Requires PostgreSQL running locally or on a cloud provider.
- Redis is needed for real-time notifications.
- The frontend is required for full functionality [here](https://github.com/Usagi5677/helpdesk-prototype-frontend).

## 📄 License

This project is for portfolio purposes. Do not use it for commercial projects without permission.
