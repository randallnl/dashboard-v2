# Shopify market sales workflow

1. In Shopify, schedule the daily sales report to email `shopify-sales@nhsolidarityecosystem.com`.
2. Configure the email route for that address to the `shopify-market-sales-ingest` Worker.
3. In **Operations → Finance → Daily Shopify sales**, optionally connect each report to its project or event.
4. Cash remains in **cash awaiting deposit** until a staff member marks that daily amount deposited.

The ingestion worker is idempotent: resending the same Shopify email does not create a second sales record. It captures Total, Cash, Card/Credit Card/Shopify Payments, and an Other remainder when those labels are present in the email. If Shopify changes its report format, use the email subject shown in the table to identify the record that needs parser adjustment.

The Finance view keeps the seven most recent daily reports visible, including reports with $0 in sales. Linking a report to a project or event is optional. Reports that do not expose a recognizable total remain visible for review with all tender amounts at $0.
