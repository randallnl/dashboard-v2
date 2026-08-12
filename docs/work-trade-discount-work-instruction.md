# Work Instruction: Monthly CoLab Work-Trade Discounts

## Purpose

This instruction explains how the team reviews logged member work, confirms a monthly membership discount, receives the member’s opt-in, and completes the required Shopify subscription update.

The dashboard performs the initial calculation and tracks the workflow. An administrator remains responsible for reviewing the work, approving or declining the discount, and manually updating Shopify after the member opts in.

## Membership prices and limits

| Membership           | Monthly price | Maximum discount | Minimum member payment |
| -------------------- | ------------: | ---------------: | ---------------------: |
| CoLab-only member    |           $20 |              $10 |                    $10 |
| Full member          |           $30 |              $20 |                    $10 |
| Key holder/keyholder |           $30 |              $20 |                    $10 |

Retail-only members, volunteers, and administrator records are not included in the work-trade calculation.

The dashboard will not calculate a discount that reduces a member’s monthly payment below $10.

## Roles

### Member

- Makes sure their work is logged through the normal Monday activity process.
- Reviews the approved monthly summary in their dashboard.
- Chooses whether to opt in to the approved discount.

### Administrator

- Generates the monthly summaries.
- Reviews every activity and its suggested dollar credit.
- Corrects individual activity amounts when needed.
- Approves the discount or closes the month without a discount.
- Updates the member’s subscription contract in Shopify after the member opts in.
- Marks the Shopify update complete in the dashboard.

## When to complete this process

Complete the review after the prior month’s work has been entered and corrected in Monday, and before making the corresponding Shopify subscription changes.

The dashboard opens to the previous month by default. Use the month selector when reviewing another period.

## What the system does automatically

When an administrator selects **Generate summaries**, the dashboard:

1. Reads member activity from the connected Monday activity board.
2. Matches activities to members using the member ID stored on the activity.
3. Includes only activities whose submitted date falls within the selected month.
4. Determines whether the member uses the $20 or $30 membership price.
5. Classifies each activity using the rules below.
6. Converts the activity’s percentage into a dollar amount based on that member’s price.
7. Caps the combined monthly discount so at least $10 remains due.
8. Creates or refreshes a monthly D1 review record while it is still awaiting review.
9. Displays the monthly summary in the admin discount queue and activity ledger.

Once a record has been approved, opted in, closed without a discount, or marked as updated in Shopify, regenerating summaries does not silently replace that reviewed record.

## Default activity calculation

Each matching activity receives the following starting percentage. The percentage is converted to dollars using the member’s normal monthly price.

| Activity recognized by the system                                                                                          |       Starting percentage | $20 membership | $30 membership |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------: | -------------: | -------------: |
| Planning or hosting a community event; coordinating an artist collaboration                                                |                       75% |     Up to $10* |     Up to $20* |
| Grant writing; event setup or breakdown; exhibition or pop-up support                                                      |                       50% |            $10 |            $15 |
| Hosting studio hours; developing a programming idea or program                                                             |                       25% |             $5 |          $7.50 |
| Inventory, Totally Tea, or filling/shipping orders                                                                         |                       20% |             $4 |             $6 |
| Quarterly sticker or sticker-pack fulfillment                                                                              |                       15% |             $3 |          $4.50 |
| Event graphics or design                                                                                                   |                       10% |             $2 |             $3 |
| CoLab maintenance: mopping/sweeping, cleaning tables, resetting the entry table, taking out trash, or specified organizing |                       10% |             $2 |             $3 |
| Social media or promotion                                                                                                  |                        5% |             $1 |          $1.50 |
| New tool announcements, opportunities, or member announcements                                                             |                        5% |             $1 |          $1.50 |
| Guest pass or check-in                                                                                                     |                        0% |             $0 |             $0 |
| Unrecognized activity                                                                                                      | 0% and flagged for review |             $0 |             $0 |

\* The $10 minimum-payment rule caps a 75% activity at $10 for a $20 membership and $20 for a $30 membership.

### How multiple activities are calculated

The system calculates activities in the order received from Monday. It assigns the normal dollar amount to each activity until the member reaches their monthly maximum discount. If the remaining discount capacity is smaller than the next activity’s normal amount, that activity receives only the remaining amount. Later activities receive $0 after the monthly maximum is reached.

Example for a $20 CoLab-only member:

- Event setup at 50% = $10.
- Social promotion at 5% would normally equal $1.
- Because the $10 monthly maximum has already been reached, the promotion activity is displayed with a $0 applied discount.
- The member still owes the $10 minimum payment.

## Monthly administrator procedure

### 1. Confirm that work is ready in Monday

Before generating summaries:

- Confirm work activities have the correct member ID.
- Confirm the submitted date is in the intended month.
- Correct incomplete or duplicate activity records.
- Confirm descriptions are specific enough to understand the work performed.

### 2. Generate the summaries

1. Sign in to the dashboard with an administrator account.
2. Open **Work-trade discount**.
3. Select the month to review.
4. Select **Generate summaries**.
5. Wait for the dashboard to confirm that it read Monday and generated the summaries.

Only members with matching work activity for the selected month appear in the queue.

### 3. Review all available activity

Use **Activity discount ledger** to review all generated activities for the selected month in one list. The ledger shows:

- Member name and membership type.
- Activity type and system reason.
- Activity date.
- Applied dollar discount.
- Whether an administrator overrode the amount.
- Current monthly review status.

Use this ledger to check consistency across members before approving individual summaries.

### 4. Review an individual member

In **Discount queue**, open **Review logged work** for the member. Confirm:

- Every activity belongs to that member.
- Every activity occurred during the selected month.
- The reason accurately describes the contribution.
- The applied amount is reasonable.
- Any activity marked **Needs review** is investigated.
- The total leaves at least $10 due.

### 5. Override an activity when necessary

Overrides are available only while the record says **Awaiting admin review**.

1. Find the activity under **Review logged work**.
2. Enter the intended dollar credit in **Discount**.
3. Select **Save**.
4. Confirm that the dashboard reports the activity was updated.
5. Recheck the member’s recalculated monthly total.

The dashboard constrains an individual override to the member’s monthly maximum and reallocates the remaining activity credits so the combined discount never causes a payment below $10. The edited activity is prioritized, followed by other overridden activities, then the remaining automatically calculated activities.

An overridden activity is labeled **Admin override** in the activity ledger.

### 6. Approve or close the monthly discount

After reviewing all activities:

- Select **Approve** to lock the eligible total and make opt-in available to the member.
- Select **Close without discount** when the calculated discount is $0, the logged activity is not eligible, or the member is known not to want to opt in that month.

Closing without a discount preserves the month and its activity history, records a $0 approved amount, and prevents an opt-in action from being offered to the member. No Shopify update is required.

Do not approve a record until all activity overrides are complete. Approved records cannot be edited through the activity override controls.

## Member opt-in procedure

After approval, the member sees **Approved—opt in available** on their dashboard.

The member must:

1. Open **Work-trade discount**.
2. Select the reviewed month.
3. Review their logged work, applied activity amounts, total discount, and remaining payment.
4. Select **Opt in to [amount] discount**.
5. Confirm the opt-in message.

Approval alone does not authorize the Shopify change. The administrator must wait until the status changes to **Opted in—Shopify update needed**.

## Shopify update procedure

When a record says **Opted in—Shopify update needed**:

1. Open Shopify from the dashboard.
2. Locate the member’s active membership subscription contract.
3. Confirm the member and membership type match the dashboard record.
4. Apply the approved discount to the appropriate subscription billing arrangement.
5. Verify that the resulting monthly amount is no lower than $10.
6. Return to the dashboard.
7. Select **Mark Shopify updated**.

The dashboard changes the status to **Applied in Shopify** and records the completion time.

## Membership payment history

As soon as the member opts in, the dashboard automatically adds a work-trade credit to **Membership payments and credits**.

The credit:

- Appears as a negative green amount, such as `-$10.00`.
- Is labeled **Work-trade discount opted in for [month]**.
- Uses the opt-in date for transaction ordering.
- Remains visible after Shopify is marked updated.
- Does not create a duplicate if the payment history is reloaded.

This is a dashboard record of the approved credit. It does not replace the administrator’s manual Shopify subscription update.

## Status reference

| Dashboard status               | Meaning                                                                          | Next action                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Awaiting admin review          | Summary has been generated but not approved                                      | Review activities, make overrides, then approve or close without a discount |
| Approved—opt in available      | Admin approved the calculated amount                                             | Member decides whether to opt in                                            |
| Opted in—Shopify update needed | Member accepted the approved discount                                            | Admin updates the Shopify subscription                                      |
| Closed—no discount             | Admin closed the month because no discount applies or the member will not opt in | No further action or Shopify update is required                             |
| Applied in Shopify             | Admin confirmed the manual subscription update                                   | Process complete                                                            |

## Exceptions and troubleshooting

### A member or activity is missing

Check the Monday activity record for:

- Correct member ID.
- Correct submitted month.
- A saved activity record.

Correct Monday, then select **Generate summaries** again. Regeneration updates records only while they are awaiting review.

### An activity says “Needs review”

The activity did not match a configured category. Read its description, confirm it represents eligible work, and enter an appropriate activity-level override. Leave it at $0 if it is not eligible.

### The calculated total is lower than the sum of the activity percentages

This normally means the member reached the maximum allowable discount. Check the applied dollar amount on each activity; later activities may receive a partial or $0 amount so that at least $10 remains due.

### The discount was approved before an amount was corrected

Do not update Shopify. Record the issue with the program administrator or dashboard maintainer before proceeding. Activity-level overrides are intentionally locked after approval to protect the audit trail.

### The member does not opt in

Do not change Shopify. The approved amount remains available for that monthly record, but it is not applied unless the member explicitly opts in.

## Monthly completion checklist

- [ ] Monday activity records are complete and assigned to the correct member IDs.
- [ ] The correct month is selected.
- [ ] Summaries have been generated.
- [ ] The all-activity ledger has been reviewed for consistency.
- [ ] Unmapped activities have been reviewed.
- [ ] Necessary per-activity overrides have been saved.
- [ ] Each member summary has been approved or closed without a discount.
- [ ] Opted-in records have been updated manually in Shopify.
- [ ] Completed Shopify updates are marked in the dashboard.
- [ ] Work-trade credits appear in the members’ payment histories.

## System boundary

The dashboard automates data collection, calculation, review tracking, member opt-in, and transaction-history display. It does **not** automatically modify Shopify subscription contracts. That final change remains a manual administrator responsibility.
