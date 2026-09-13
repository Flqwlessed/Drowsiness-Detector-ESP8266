DRIVER GUARD - DANGER SOS POPUP VERSION
=======================================

WHAT CHANGED
------------
The full project has been rebuilt with the same ESP8266 + Python +
dashboard + location + SMS pipeline, plus a new emergency SOS popup.

When the simulated vehicle fully stops:
1. SOS becomes active.
2. A red emergency-style popup appears.
3. The popup shows:
   - Vehicle stopped
   - Braking 100%
   - Hazards active
   - SMS status
   - Snapshot location
   - Open Map button
4. Browser location is requested.
5. The captured coordinates are converted to a Google Maps link.
6. Mock/real SMS uses the same snapshot location.

HARDWARE
--------
Eye sensor VCC -> NodeMCU 3V3
Eye sensor GND -> NodeMCU GND
Eye sensor OUT -> NodeMCU A0

Small active buzzer + -> D5
Small active buzzer - -> GND

NodeMCU -> laptop using USB data cable

START
-----
1. Upload:
   esp8266/esp8266_drowsiness.ino

2. Close Arduino Serial Monitor.

3. Copy:
   .env.example

   Rename the copy:
   .env

4. Start with:
   SMS_MODE=mock
   SOS_PHONE=+91YOUR_NUMBER

5. Install:
   python -m pip install -r requirements.txt

6. Run:
   python app.py

7. Open:
   http://127.0.0.1:5000

TEST
----
Click Demo mode.

After about 10 seconds:
- car reaches 0 km/h
- stop marker appears
- SOS triggers
- red emergency popup appears
- browser requests location
- location snapshot is shown
- Open Map becomes available
- mock SMS is printed to the terminal

REAL TEST SMS
-------------
Only use your own number or a trusted test number.

Set:
SMS_MODE=real

Then configure:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

IMPORTANT
---------
Student prototype / simulation only.
No real vehicle actuation.
No emergency-service contact.
Do not configure 112 or another emergency-service number.


IMPORTANT FIX IN THIS VERSION
-----------------------------
The emergency state now stays latched after the vehicle reaches 0 km/h.

Previously, opening your eyes immediately after the stop could send EYE_OPEN,
which reset SOS before browser geolocation finished. That could make the
popup disappear and prevent the SMS from being sent.

Now:
- the stop/SOS stays active after the eyes reopen
- browser location has time to complete
- the SMS pipeline can finish
- use RESET INCIDENT in the popup to start another test

There is also a TEST LOCATION button so you can verify browser location
before running the full drowsiness sequence.


MANUAL LOCATION - FASTEST DEMO METHOD
-------------------------------------
Windows Location Services are NOT required in this version.

1. On your phone, open Google Maps.
2. Press/hold your current position.
3. Copy the coordinates, for example:
       19.123456, 72.987654
4. On the Driver Guard dashboard:
       paste 19.123456 into LATITUDE
       paste 72.987654 into LONGITUDE
5. Click:
       USE THESE COORDINATES
6. You should see:
       Location saved
       OPEN LOCATION IN MAPS becomes active
7. Start Demo mode.

The coordinates are intentionally preserved when the demo starts.

When the car reaches 0 km/h and SOS triggers, the app re-submits the
saved coordinates to the backend. This causes the mock/real SMS pipeline
to use the saved map location without needing Windows Location Services.

PHYSICAL SMS REMINDER
---------------------
SMS_MODE=mock:
    No physical SMS. The message is printed in the terminal.

SMS_MODE=real:
    Physical test SMS can be attempted through the configured Twilio
    account, using your own or a trusted test number.
