PRD: Daily Streak Tracking & Goal Completion for LMS

Objective

To track the user goals based on the tasks that they complete in our LMS application. Once the task is completed, the streak is marked as completed for the user if they meet the defined criteria (e.g., out of 5 tasks, completing any 2 marks the day as done). This also includes:

Daily streak tracking (consecutive days with goal completion)

XP point system based on task type and completion

Handling inactivity by marking missed days

Future Objective

Users can select personalized daily goals from a predefined list. Once any 'n' goals (user-defined subset) are completed for the day, the streak is updated, and tasks are logged accordingly.

User Flow

User logs in → View current week streak and consecutive streak (total days in a row).

User taps streak card → Opens bottom sheet with calendar of current month:

✅ Completed days

❌ Missed days

Current day selected by default → Shows list of completed tasks (user activity).

Even if streak is already marked, full activity log is still shown.

User selects another day → Shows respective day's activity or missed message.

Missed day → Show "You missed checking the App!" with empty or partial task info.

User completes daily minimum required tasks → Trigger streak update:

Show streak animation

Update streak, daily_goals, xp_points

Return: updated streak count, completed date, list of tasks

Animation shown only once per day.