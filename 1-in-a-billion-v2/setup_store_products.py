#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║  1 in a Billion — Google Play Store Product Setup Script            ║
║                                                                      ║
║  Automates creation of all in-app products and subscriptions         ║
║  in Google Play Console via the Android Publisher API.               ║
║                                                                      ║
║  Usage:                                                              ║
║    1. pip install google-auth google-api-python-client               ║
║    2. Edit PACKAGE_NAME and SERVICE_ACCOUNT_KEY_PATH below           ║
║    3. python setup_store_products.py                                 ║
║                                                                      ║
║  Note: Apple App Store does NOT have a public API for creating       ║
║  in-app purchases. Those must be created manually in App Store       ║
║  Connect (see the Word doc guide for step-by-step instructions).     ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import json
import sys
import time

# ══════════════════════════════════════════════════════════════════════
# 🎯 CONFIGURE THESE TWO VALUES
# ══════════════════════════════════════════════════════════════════════

PACKAGE_NAME = "com.yourcompany.oneinabillion"  # <-- Your app's applicationId from build.gradle
SERVICE_ACCOUNT_KEY_PATH = "service-account-key.json"  # <-- Path to Google Cloud service account JSON

# ══════════════════════════════════════════════════════════════════════
# PRODUCT DEFINITIONS (matching the app's revenuecatCatalog.ts)
# ══════════════════════════════════════════════════════════════════════

IN_APP_PRODUCTS = [
    {
        "sku": "single_system",
        "title": "Single System Reading",
        "description": "Get a personalized reading for one astrological system — approximately 40 minutes of narrated audio and a 10-page PDF.",
        "price_usd_micros": 13_990_000,  # $13.99
        "purchaseType": "managedUser",  # consumable
    },
    {
        "sku": "complete_reading",
        "title": "Complete Reading (All 5 Systems)",
        "description": "All 5 astrological systems analyzed for one person — 200 minutes of audio, 50 pages. Save 50% vs buying individually.",
        "price_usd_micros": 33_990_000,  # $33.99
        "purchaseType": "managedUser",
    },
    {
        "sku": "compatibility_overlay",
        "title": "Compatibility Overlay",
        "description": "Compare two people in one astrological system — individual readings plus a deep compatibility analysis. 120 minutes of audio.",
        "price_usd_micros": 40_990_000,  # $40.99
        "purchaseType": "managedUser",
    },
    {
        "sku": "nuclear_package",
        "title": "Nuclear Package (Everything)",
        "description": "The ultimate package: all 5 systems for both people, all overlays, plus a final verdict. 640+ minutes of audio, 160+ pages. 50% off.",
        "price_usd_micros": 107_990_000,  # $107.99
        "purchaseType": "managedUser",
    },
]

SUBSCRIPTIONS = [
    {
        "productId": "basic_monthly",
        "title": "Basic Monthly",
        "description": "1 extended reading per month, daily compatibility matching, and ongoing background resonance updates.",
        "basePlan": {
            "basePlanId": "basic-monthly-plan",
            "billingPeriod": "P1M",  # Monthly
            "price_usd_micros": 20_990_000,  # $20.99
            "autoRenewing": True,
        },
    },
    {
        "productId": "yearly_subscription",
        "title": "108 Yearly",
        "description": "3 extended readings per month, daily compatibility matching, narrated readings with audio and PDF. Best value!",
        "basePlan": {
            "basePlanId": "yearly-plan",
            "billingPeriod": "P1Y",  # Yearly
            "price_usd_micros": 107_990_000,  # $107.99
            "autoRenewing": True,
        },
    },
    {
        "productId": "billionaire_yearly",
        "title": "Billionaire",
        "description": "108 readings per month — unlimited compatibility readings, all systems, all overlays. The ultimate experience.",
        "basePlan": {
            "basePlanId": "billionaire-yearly-plan",
            "billingPeriod": "P1Y",  # Yearly
            "price_usd_micros": 10_007_990_000,  # $10,007.99
            "autoRenewing": True,
        },
    },
]

# ══════════════════════════════════════════════════════════════════════
# IMPLEMENTATION
# ══════════════════════════════════════════════════════════════════════

def get_service():
    """Authenticate and return Android Publisher API service."""
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        print("\n❌ Missing dependencies. Install them with:")
        print("   pip install google-auth google-api-python-client\n")
        sys.exit(1)

    try:
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_KEY_PATH,
            scopes=["https://www.googleapis.com/auth/androidpublisher"],
        )
    except FileNotFoundError:
        print(f"\n❌ Service account key not found at: {SERVICE_ACCOUNT_KEY_PATH}")
        print("   Download it from Google Cloud Console > IAM > Service Accounts > Keys")
        print(f"   Save it as '{SERVICE_ACCOUNT_KEY_PATH}' in this directory.\n")
        sys.exit(1)

    return build("androidpublisher", "v3", credentials=credentials)


def create_in_app_products(service):
    """Create all consumable in-app products."""
    print("\n" + "═" * 60)
    print("  CREATING IN-APP PRODUCTS (Consumables)")
    print("═" * 60)

    for product in IN_APP_PRODUCTS:
        print(f"\n  → Creating: {product['sku']} (${product['price_usd_micros'] / 1_000_000:.2f})")

        body = {
            "sku": product["sku"],
            "status": "active",
            "purchaseType": product["purchaseType"],
            "defaultLanguage": "en-US",
            "listings": {
                "en-US": {
                    "title": product["title"],
                    "description": product["description"],
                },
            },
            "defaultPrice": {
                "priceMicros": str(product["price_usd_micros"]),
                "currency": "USD",
            },
        }

        try:
            service.inappproducts().insert(
                packageName=PACKAGE_NAME,
                body=body,
            ).execute()
            print(f"    ✅ Created successfully")
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg.lower() or "409" in error_msg:
                print(f"    ⚠️  Already exists (skipping)")
            else:
                print(f"    ❌ Error: {error_msg}")

        time.sleep(0.5)  # Rate limiting


def create_subscriptions(service):
    """Create all subscription products with base plans."""
    print("\n" + "═" * 60)
    print("  CREATING SUBSCRIPTIONS")
    print("═" * 60)

    for sub in SUBSCRIPTIONS:
        print(f"\n  → Creating subscription: {sub['productId']}")
        bp = sub["basePlan"]

        # Step 1: Create the subscription
        body = {
            "productId": sub["productId"],
            "listings": [
                {
                    "languageCode": "en-US",
                    "title": sub["title"],
                    "description": sub["description"],
                },
            ],
            "basePlans": [
                {
                    "basePlanId": bp["basePlanId"],
                    "autoRenewingBasePlanType": {
                        "billingPeriodDuration": bp["billingPeriod"],
                    },
                    "regionalConfigs": [
                        {
                            "regionCode": "US",
                            "price": {
                                "currencyCode": "USD",
                                "units": str(bp["price_usd_micros"] // 1_000_000),
                                "nanos": (bp["price_usd_micros"] % 1_000_000) * 1000,
                            },
                        },
                    ],
                    "state": "ACTIVE",
                },
            ],
        }

        try:
            service.monetization().subscriptions().create(
                packageName=PACKAGE_NAME,
                body=body,
                productId=sub["productId"],
            ).execute()
            print(f"    ✅ Created: {sub['productId']} ({sub['title']})")
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg.lower() or "409" in error_msg:
                print(f"    ⚠️  Already exists (skipping)")
            else:
                print(f"    ❌ Error: {error_msg}")

        time.sleep(0.5)


def print_summary():
    """Print a summary of what was configured."""
    print("\n" + "═" * 60)
    print("  SUMMARY")
    print("═" * 60)
    print(f"\n  Package Name: {PACKAGE_NAME}")
    print(f"  Service Key:  {SERVICE_ACCOUNT_KEY_PATH}")
    print(f"\n  In-App Products ({len(IN_APP_PRODUCTS)}):")
    for p in IN_APP_PRODUCTS:
        print(f"    • {p['sku']:30s} ${p['price_usd_micros'] / 1_000_000:>10,.2f}")
    print(f"\n  Subscriptions ({len(SUBSCRIPTIONS)}):")
    for s in SUBSCRIPTIONS:
        bp = s["basePlan"]
        period = "month" if bp["billingPeriod"] == "P1M" else "year"
        print(f"    • {s['productId']:30s} ${bp['price_usd_micros'] / 1_000_000:>10,.2f}/{period}")
    print()


def main():
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║  1 in a Billion — Google Play Product Setup                 ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    # Validate config
    if PACKAGE_NAME == "com.yourcompany.oneinabillion":
        print("\n⚠️  WARNING: You haven't set your PACKAGE_NAME yet!")
        print("   Edit the top of this script and set PACKAGE_NAME to your")
        print("   app's applicationId (from android/app/build.gradle).")
        resp = input("\n   Continue anyway? (y/N): ").strip().lower()
        if resp != "y":
            print("   Exiting. Edit the script and try again.\n")
            sys.exit(0)

    print_summary()

    resp = input("  Proceed with creating all products? (y/N): ").strip().lower()
    if resp != "y":
        print("  Cancelled.\n")
        sys.exit(0)

    service = get_service()
    create_in_app_products(service)
    create_subscriptions(service)

    print("\n" + "═" * 60)
    print("  ✅ DONE!")
    print("═" * 60)
    print("\n  Next steps:")
    print("  1. Verify products in Google Play Console > Monetize")
    print("  2. Upload service account JSON to RevenueCat")
    print("  3. Create Offerings in RevenueCat (see guide Section 4.3)")
    print("  4. Test with an internal testing track\n")


if __name__ == "__main__":
    main()
