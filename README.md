# LifeLink - Healthcare Donation Platform

LifeLink is a web-based emergency health and donation management system that connects patients, donors, and hospitals on a single platform. It allows patients to request blood, beds, medicines, and hospital availability, while donors can offer blood and medicine donations. Hospitals manage and respond to these requests, with admin overseeing the entire system.


## Features

* User Authentication and Authorization

  * Multiple user types (Admin, Donor, Hospital, Patient)
  * Secure login with password hashing and Google OAuth
  * Role-based access control for data privacy and restricted actions

* Donation & Request Management

  * Blood and medicine donation forms with donor history
  * Patient requests for blood, beds, medicines, and hospital availability
  * Hospitals manage and respond to requests with real-time updates

* Dashboard Analytics

  * System-wide statistics in the Admin panel
  * Donor and patient-specific request and donation history
  * Status tracking: Pending, Accepted, Rejected

* Hospital Response System

  * Hospitals receive and verify requests
  * Custom response forms for each request type
  * Actions are reflected back to patient and donor dashboards

* Centralized Database (MongoDB)

  * Structured storage of users, requests, and donation records
  * Easy retrieval and filtering of data per user role

Let me know if you want a shorter version for the slide or explanation points for each feature.



## Link to the Website

- https://lifelink-l9n1.onrender.com


## Tech Stack

- Frontend:
  - HTML
  - CSS
  - JavaScript

- Backend:
  - Node.js
  - Express.js
  - MongoDB


## Default Admin Account

The system automatically creates a default admin account on first run:
- Email: admin@lifelink.com
- Password: admin123

