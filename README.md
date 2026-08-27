# TransactPay Accounting & Automated Reconciliation System

A production-ready, multi-tenant accounting engine and reconciliation dashboard built for processing TransactPay API transaction streams and CSV settlement uploads.

## Features
- **Multi-Tenant JWT Authentication**: Complete merchant isolation via micro-service authentication and database foreign key scoping.
- **Dynamic Metrics Engine**: Real-time calculation of Gross Volume, Gateway Fees, Net Settled Funds, and Discrepancies.
- **Automated Nightly Sync**: Built-in background cron runner (`node-cron`) to periodically pull settlements from TransactPay endpoints.
- **Client-Side CSV Reporting**: Instant regex live filtering and client-side CSV exports.
- **Dockerized Architecture**: Fully containerized Node.js app paired with a persistent PostgreSQL database.

## System Architecture