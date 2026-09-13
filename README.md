# DriverGuard - Driver Drowsiness Detection and Safety System

DriverGuard is a project we made to detect driver drowsiness and respond before it can potentially lead to an accident.

The main idea is pretty simple: the system continuously checks whether the driver's eyes are open or closed. Normal blinking is ignored, but if the eyes remain closed for longer than expected, the system starts warning the driver.

Our current prototype uses an ESP8266, an IR eye sensor and a buzzer. It is connected to a Python/Flask dashboard which shows the state of the driver and simulates what a future vehicle-integrated safety system could do.

The project also has location tracking, Google Maps integration and Telegram SOS notifications.

> Important: The automatic braking shown in this project is currently a simulation. The ESP8266 is NOT connected to the brakes, steering, accelerator, ABS, EBS or any other safety-critical system of a real vehicle.

---

## Why We Made This

Driver fatigue is a serious problem, especially for truck drivers who may spend long hours travelling on highways.

A normal drowsiness alarm can warn the driver, but we wanted to explore what could happen if the driver does not respond to that warning.

So our system follows this basic idea:

```text
Monitor Driver
      ↓
Drowsiness Detected
      ↓
Warn Driver
      ↓
Driver Still Unresponsive
      ↓
Simulate Controlled Deceleration
      ↓
Simulated Vehicle Stop
      ↓
Get Location
      ↓
Send SOS Notification
```

The long-term idea is to develop DriverGuard into a fleet-safety system for commercial trucks.

---

# Current Prototype

Our prototype currently has:

- ESP8266 NodeMCU
- IR eye sensor
- Active buzzer
- Python backend
- Flask web server
- HTML/CSS/JavaScript dashboard
- Google Maps location
- Telegram Bot API
- Serial communication between ESP8266 and Python
- Simulated vehicle braking
- Simulated hazard lights and horn
- Emergency SOS state

---

# How It Works

The eye sensor continuously gives an analog value to the ESP8266.

During our testing we observed approximately:

```text
Eyes open   → low sensor value
Eyes closed → high sensor value
```

We currently use:

```text
Closed threshold = 300
```

The exact value can change depending on sensor placement, lighting and the person using the system, so it should be calibrated before a demonstration.

The basic timing used in our prototype is:

```text
0 - 2 seconds
Eyes closed
System monitors the driver

2 seconds
Buzzer turns ON

5 seconds
Drowsiness condition begins
Simulated hazards + braking begin

5 - 10 seconds
Simulated braking gradually increases
Simulated speed decreases

10 seconds
Simulated vehicle reaches 0 km/h
SOS state is triggered
Location is attached
Telegram notification is sent
```

Opening the eyes turns the physical buzzer off.

After an emergency stop has already been triggered, the SOS state remains latched until the system is reset. This prevents the emergency information from disappearing just because the driver's eyes opened afterwards.

---

# ESP8266 Connections

## Components

For the current hardware prototype we use:

| Component | Purpose |
|---|---|
| NodeMCU V3 ESP8266 | Main microcontroller |
| IR Eye Sensor | Detects open/closed eye condition |
| Active Buzzer | Alerts the driver |
| USB Cable | Programming + power + serial communication |
| Jumper Wires | Connections |
| Laptop | Runs Flask dashboard |

---

## Eye Sensor to ESP8266

Our eye sensor uses an analog output.

```text
EYE SENSOR                ESP8266

VCC  ------------------>  3.3V
GND  ------------------>  GND
OUT / AO ------------->   A0
```

### Important

`A0` is a signal input. It is NOT a power pin.

The sensor output must remain within the voltage range supported by the particular NodeMCU board.

Do not feed 5V directly into the ESP8266 analog input.

---

## Buzzer to ESP8266

For the small active buzzer used in our prototype:

```text
BUZZER                    ESP8266

Signal / + ------------>  D5
- --------------------->  GND
```

On the NodeMCU:

```text
D5 = GPIO14
```

For a larger buzzer/speaker that needs more current, it should not be powered directly from the ESP8266 GPIO. A proper driver circuit would be required.

---

# Complete Prototype Wiring

```text
                    ┌──────────────────────┐
                    │   NodeMCU ESP8266    │
                    │                      │
Eye Sensor VCC ────►│ 3.3V                 │
Eye Sensor GND ────►│ GND                  │
Eye Sensor OUT ────►│ A0                   │
                    │                      │
Buzzer Signal ─────►│ D5 / GPIO14          │
Buzzer GND ────────►│ GND                  │
                    │                      │
                    │ USB                  │
                    └──────────┬───────────┘
                               │
                               │ Serial @ 9600 baud
                               │
                               ▼
                         ┌───────────┐
                         │  Laptop   │
                         │  Python   │
                         │  Flask    │
                         └─────┬─────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │ DriverGuard        │
                    │ Web Dashboard      │
                    └──────┬─────────────┘
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
             Google Maps        Telegram
              Location             SOS
```

---

# Arduino IDE Setup

The board used in this project is:

```text
NodeMCU 1.0 (ESP-12E Module)
```

The ESP8266 board package can be installed through Arduino IDE.

Our serial communication uses:

```text
Baud Rate: 9600
```

The Arduino Serial Monitor must be closed before starting the Python program because only one application can normally use the COM port at a time.

---

# Serial Messages

The ESP8266 sends messages such as:

```text
SYSTEM_READY
SENSOR:9
EYE_OPEN

EYE_CLOSED
CLOSED_MS:2050
BUZZER:ON

STATE:DROWSY
HAZARD:ON
HORN:ON
BRAKE:35

STATE:EMERGENCY_STOP
BRAKE:100
SPEED:0
VEHICLE_STOPPED
SOS:TRIGGER
```

Python reads these messages and updates the dashboard.

---

# Dashboard

The dashboard shows the current state of the prototype in real time.

It displays things such as:

- Eye status
- Sensor reading
- Eye-closure duration
- Buzzer state
- Simulated vehicle speed
- Simulated braking percentage
- Hazard state
- Horn state
- Emergency state
- Location
- Google Maps
- Telegram notification status

The browser communicates with Flask while Flask communicates with the ESP8266 over USB serial.

---

# Google Maps

For our demonstration we can use a fixed location:

```text
Latitude:  19.7094869
Longitude: 72.792461
```

Google Maps can display these coordinates on the dashboard.

This fixed location is only for demonstration and should not be described as live GPS.

In a real truck version, the coordinates would come from an actual GNSS/GPS telematics device.

---

# Telegram SOS

When the simulated vehicle reaches the emergency-stop state, the backend can send a Telegram message to our configured account.

Example:

```text
🚨 DRIVER GUARD SOS

Drowsiness remained detected.

Vehicle simulation stopped.

Location:
19.7094869, 72.792461

Google Maps:
[location link]

STUDENT PROJECT SIMULATION
```

Telegram credentials are stored in a `.env` file rather than directly inside the source code.

Example:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID
```

Do not upload the real `.env` file to GitHub.

---

# Running the Project

Install the Python dependencies:

```bash
python -m pip install flask pyserial requests python-dotenv
```

Upload the ESP8266 program using Arduino IDE.

Close Arduino Serial Monitor.

Then start the backend:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

The dashboard should now communicate with the ESP8266.

---

# How This Could Work in a Real Truck

Our current system is a proof of concept.

The ESP8266 and basic IR eye sensor would not be the final hardware installed in a commercial truck.

A possible production architecture would be:

```text
                 DRIVER
                    │
                    ▼
          IR/NIR DMS CAMERA
                    │
                    ▼
       AUTOMOTIVE PROCESSING ECU
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
 Driver Warning   GNSS       Vehicle
 Speaker/Display  + 4G       Telemetry
                    │
                    ▼
              CLOUD SERVER
                    │
             Fleet Dashboard
                    │
             Fleet Operator
```

The production version could replace:

```text
OUR PROTOTYPE              POSSIBLE REAL VERSION

IR Eye Sensor       →      IR/NIR DMS Camera
ESP8266             →      Automotive Processing ECU
USB Power           →      Protected Automotive Power Supply
Wi-Fi               →      4G/LTE Connectivity
Demo Coordinates    →      GNSS/GPS
Laptop              →      Embedded/Cloud Backend
Telegram            →      Fleet Alert Platform
Simulated Speed     →      Vehicle Telematics
Simulated Braking   →      Future OEM ADAS Integration
```

---

# What About Automatic Braking?

This is an important limitation of our current project.

Our ESP8266 does NOT control the brakes of a real vehicle.

Modern heavy trucks can contain systems such as:

```text
Driver Monitoring System
          ↓
Automotive Safety / ADAS ECU
          ↓
Vehicle Safety Logic
          ↓
EBS / ABS / ESC
          ↓
Pneumatic Braking System
          ↓
Wheel Brakes
```

Heavy trucks commonly use compressed-air braking systems together with electronic braking and stability systems.

A future automotive version of DriverGuard could potentially provide a validated driver-unresponsive condition to a manufacturer's safety architecture.

The manufacturer's validated system would then be responsible for deciding whether and how vehicle intervention should occur.

We are NOT using:

```text
ESP8266 → Real Truck Brakes
```

The braking animation in our dashboard exists to demonstrate the concept.

Actual brake integration would require automotive-grade electronics, vehicle-specific engineering, redundancy, testing, functional-safety work and OEM/certified integration.

---

# Real Truck Version - Estimated Cost

Our current estimate for a more realistic truck-mounted version is approximately:

| Component | Approx. Cost |
|---|---:|
| IR/NIR Driver Monitoring Camera | ₹4,000 |
| Embedded Processing Unit | ₹5,000 |
| Automotive Power & Protection | ₹1,000 |
| Speaker/Buzzer & Indicators | ₹500 |
| Rugged Enclosure + Wiring | ₹1,500 |
| AIS-140/GNSS/4G Telematics | ₹10,000 |
| Installation & Testing | ₹2,000 |
| Other Hardware/Calibration | ₹2,000–₹6,000 |
| **Estimated Total** | **~₹30,000/truck** |

These are project estimates, not final supplier quotations.

At higher manufacturing volumes, the hardware cost could potentially decrease.

---

# Revenue Model

Our main target customer would be commercial fleet operators rather than individual drivers.

We are considering a B2B hardware + software model.

Example:

```text
Estimated system cost:
~₹30,000 / truck

Possible selling price:
~₹45,000 / truck

Hardware gross contribution:
~₹15,000 / truck
```

The fleet-management software could then be provided as a subscription.

```text
DriverGuard Fleet Subscription

₹499 / truck / month

Includes:

- Fleet dashboard
- Drowsiness alerts
- Location monitoring
- Incident history
- Driver safety reports
- Device monitoring
- Software updates
```

For example, with 100 connected trucks:

```text
Hardware:

100 × ₹45,000
= ₹45,00,000


Subscription:

100 × ₹499
= ₹49,900/month

= ₹5,98,800/year
```

This gives the project both one-time hardware revenue and recurring software revenue.

These numbers are currently business-model assumptions and would need to be validated through actual manufacturing quotations and fleet-customer research.

---

# Feasibility

We think the project is feasible because most of the technologies required already exist separately.

We are not trying to invent GPS, cameras, cellular networks or electronic vehicle systems from scratch.

Technologies already available include:

```text
✓ Driver monitoring cameras
✓ Embedded processors
✓ GNSS/GPS
✓ 4G/LTE vehicle connectivity
✓ Fleet telematics
✓ Cloud dashboards
✓ Driver warning systems
✓ Modern vehicle ADAS
```

The major challenge is integrating them into a system that is reliable, affordable and suitable for commercial vehicles.

Our current prototype proves the basic software and hardware workflow:

```text
DETECT
  ↓
ALERT
  ↓
ESCALATE
  ↓
SIMULATE INTERVENTION
  ↓
LOCATE
  ↓
NOTIFY
```

---

# Future Improvements

Some things we would like to improve later:

- Replace the basic eye sensor with an IR/NIR camera
- Computer-vision based eye detection
- Head-pose detection
- Yawning detection
- Driver identification
- Better false-positive filtering
- Dedicated GNSS
- 4G/LTE connectivity
- Fleet dashboard for multiple trucks
- Driver fatigue history
- Route-based fatigue analysis
- Offline event storage
- Automatic upload when network returns
- Automotive-grade enclosure and electronics
- Integration with existing fleet telematics
- Proper testing with different lighting conditions
- Detection while wearing glasses
- Automotive/OEM integration research

---

# Safety

DriverGuard is currently an educational prototype.

It should NOT be connected directly to:

- Real vehicle brakes
- Accelerator/throttle
- Steering
- Airbags
- ABS
- EBS
- ESC
- Safety-critical vehicle CAN networks

The braking, hazard and horn functions displayed on the dashboard are simulations.

A real automated vehicle intervention system would require professional automotive engineering, validation and appropriate certification.

---

# Tech Stack

```text
Hardware
- NodeMCU ESP8266
- IR Eye Sensor
- Active Buzzer

Embedded
- Arduino / C++

Backend
- Python
- Flask
- PySerial

Frontend
- HTML
- CSS
- JavaScript

Communication
- USB Serial
- HTTP

Services
- Google Maps
- Telegram Bot API
```

---

# Project Status

```text
Eye Detection             ✅ Working
Physical Buzzer           ✅ Working
ESP8266 Communication     ✅ Working
Real-Time Dashboard       ✅ Working
Simulated Braking         ✅ Working
Simulated Vehicle Stop    ✅ Working
Google Maps               ✅ Working
Telegram Notification     ✅ Working
Fleet Dashboard           🚧 Future Work
Real GNSS/4G Hardware     🚧 Future Work
Automotive DMS Camera     🚧 Future Work
Real Brake Integration    ❌ Not implemented
```

---

# Final Idea

DriverGuard started as a simple drowsiness detector, but the goal is to take it further than just sounding a buzzer.

We want the system to eventually connect driver monitoring with fleet safety so that if a driver becomes dangerously unresponsive, the system can warn the driver, record what happened, locate the vehicle and notify the people responsible for that vehicle.

The current prototype is our first proof that this complete chain can work.

**Detect → Alert → Respond → Locate → Notify**

---

## Disclaimer

This project is an educational prototype and automotive safety simulation. It is not an automotive-certified driver assistance or braking system and should not be used to control a moving vehicle.

Note- This is also just a simulation for now.

Developed during a hackathon.
