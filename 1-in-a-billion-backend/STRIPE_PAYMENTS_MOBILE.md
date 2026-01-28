# Stripe Payments Implementation (iOS & Android)

**Project:** 1 in a Billion  
**Date:** January 11, 2026

## 1. Payment Provider Overview

For both **iPhone (iOS)** and **Android** versions of the "1 in a Billion" application, **Stripe** is the exclusive payment processor for all digital products and horoscope readings.

### Why Stripe?

We have made a strategic decision to use **Stripe** instead of native Apple In-App Purchases (IAP) or Google Play Billing for the following reasons:

* **Refund Control:** Native platform payment systems (Apple/Google) often grant refunds automatically or via their own portals without developer consent.
* **No-Refund Policy:** Since our product (Horoscope Readings) is an instant digital content delivery service that involves significant AI compute and server cost, we **do not offer refunds** once an order is placed.
* **Unified System:** Stripe allows us to maintain a consistent payment flow and refund policy across both mobile platforms and the web.

## 2. Refund & Dispute Policy

### 2.1 All Sales Final

Due to the nature of astrological readings as personalized digital assets, all purchases made within the app are final. No refunds will be issued once the transaction is processed.

### 2.2 Exception Handling (Manual Fixes)

While we do not offer monetary refunds, we are committed to delivery. If a user experiences a technical failure such as:

* Reading not delivered in the app.
* Server breakdown during processing.
* Corrupted audio or text output.

We will provide a **Manual Fix**. Our technical team will manually regenerate the reading or fix the account state to ensure the user receives the content they paid for.

## 3. Support & Complaints

Users who encounter issues or wish to request a manual fix should contact our support team via email.

**Support Email:** [contact@1-in-a-billion.app](mailto:contact@1-in-a-billion.app)

### Complaint Process

1. User sends an email to `contact@1-in-a-billion.app` with their transaction details.
2. Support team verifies the payment status in the Stripe Dashboard.
3. If the delivery failed due to technical reasons, the team initiates a manual fix in the Supabase backend.
4. The user is notified once the reading is available in their profile.

## 4. Implementation Details

* **SDK:** Use `stripe-react-native` (or the equivalent native mobile SDK) for payment sheet integration.
* **Backend:** Ensure the `1-in-a-billion-backend` is configured with Stripe Webhooks to handle successful payments and trigger job creation in the `jobs` table.
* **UI/UX:** The checkout screen must clearly state: *"No refunds will be provided for horoscope readings. If you experience technical issues, contact support for a manual fix."*
