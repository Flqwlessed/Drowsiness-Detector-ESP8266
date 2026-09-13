from flask import Flask, render_template, jsonify, request
import os
import threading
import time
from collections import deque
from datetime import datetime

import requests
import serial
import serial.tools.list_ports
from dotenv import load_dotenv

from config import PORT, BAUD, SIMULATED_START_SPEED


load_dotenv()

TELEGRAM_ENABLED = os.getenv("TELEGRAM_ENABLED", "true").strip().lower() in {
    "1", "true", "yes", "on"
}

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()


app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)

state_lock = threading.Lock()

events = deque(
    maxlen=80
)


state = {
   "connected": False,
    "port": None,

    "sensor": None,
    "eye": "OPEN",
    "closed_ms": 0,
    "buzzer": False,

    "brake": 0,
    "speed": SIMULATED_START_SPEED,
    "hazard": False,
    "horn": False,
    "system_state": "NORMAL",
    "stopped": False,

    "sos": False,

    # GOOGLE MAP DEMO LOCATION
    "latitude": 19.7094869,
    "longitude": 72.792461,
    "location_accuracy": None,
    "location_source": "FIXED DEMO LOCATION",
    "location_label": "DriverGuard Demo Location",
    "maps_url": "https://www.google.com/maps?q=19.7094869,72.792461",

    "demo_mode": False,

    "telegram_status": "STANDBY",
    "telegram_sent": False,
    "telegram_error": "",
    "telegram_chat": None,

    "sms_status": "DISABLED",
    "sms_error": "",
}


def add_event(message):
    events.appendleft({
        "time": datetime.now().strftime(
            "%H:%M:%S"
        ),
        "message": message,
    })


def mask_chat_id(chat_id):
    value = str(
        chat_id or ""
    )

    if not value:
        return "Not configured"

    if len(value) <= 4:
        return "****"

    return (
        "*" * (
            len(value) - 4
        )
        + value[-4:]
    )


def copy_state():
    with state_lock:
        data = dict(
            state
        )

        data["events"] = list(
            events
        )

    data["telegram_enabled"] = (
        TELEGRAM_ENABLED
    )

    data["telegram_configured"] = bool(
        TELEGRAM_BOT_TOKEN
        and TELEGRAM_CHAT_ID
    )

    return data


def reset_safety_state():
    state.update({
        "eye": "OPEN",
        "closed_ms": 0,
        "buzzer": False,

        "brake": 0,
        "speed": SIMULATED_START_SPEED,
        "hazard": False,
        "horn": False,
        "system_state": "NORMAL",
        "stopped": False,

        "sos": False,

        "telegram_status": "STANDBY",
        "telegram_sent": False,
        "telegram_error": "",
        "telegram_chat": None,

        "sms_status": "DISABLED",
        "sms_error": "",
    })


def build_maps_url(
    latitude,
    longitude
):
    return (
        "https://www.google.com/maps"
        f"?q={latitude},{longitude}"
    )


def create_telegram_sos_message(
    latitude,
    longitude,
    location_source,
    accuracy=None
):

    maps_url = build_maps_url(
        latitude,
        longitude
    )

    timestamp = datetime.now().strftime(
        "%d %b %Y %H:%M:%S"
    )

    if accuracy is None:
        accuracy_text = (
            "Approximate"
        )

    else:
        accuracy_text = (
            f"±{round(float(accuracy))} m"
        )


    return f"""🚨 DRIVER GUARD SOS

Drowsiness remained detected.

✅ Vehicle simulation stopped
🛑 Simulated braking: 100%
⚠ Hazards: Active

📍 Location source:
{location_source}

📍 Location:
{latitude}, {longitude}

🎯 Accuracy:
{accuracy_text}

🗺 Map:
{maps_url}

🕒 Time:
{timestamp}

STUDENT PROJECT SIMULATION
NO EMERGENCY SERVICE WAS CONTACTED.
"""


def send_telegram_sos(
    latitude,
    longitude,
    location_source,
    accuracy=None
):

    if not TELEGRAM_ENABLED:

        with state_lock:
            state[
                "telegram_status"
            ] = "DISABLED"

        return False


    if not TELEGRAM_BOT_TOKEN:

        with state_lock:

            state[
                "telegram_status"
            ] = "TOKEN MISSING"

            state[
                "telegram_error"
            ] = (
                "TELEGRAM_BOT_TOKEN "
                "is missing in .env"
            )

        add_event(
            "Telegram bot token missing"
        )

        return False


    if not TELEGRAM_CHAT_ID:

        with state_lock:

            state[
                "telegram_status"
            ] = "CHAT ID MISSING"

            state[
                "telegram_error"
            ] = (
                "TELEGRAM_CHAT_ID "
                "is missing in .env"
            )

        add_event(
            "Telegram chat ID missing"
        )

        return False


    try:

        url = (
            "https://api.telegram.org/"
            f"bot{TELEGRAM_BOT_TOKEN}"
            "/sendMessage"
        )


        message = (
            create_telegram_sos_message(
                latitude,
                longitude,
                location_source,
                accuracy
            )
        )


        response = requests.post(

            url,

            json={
                "chat_id":
                    TELEGRAM_CHAT_ID,

                "text":
                    message,

                "disable_web_page_preview":
                    False,
            },

            timeout=10
        )


        data = response.json()


        if (
            not response.ok
            or not data.get("ok")
        ):

            raise RuntimeError(

                data.get(
                    "description",
                    (
                        "Telegram HTTP "
                        f"{response.status_code}"
                    )
                )
            )


        with state_lock:

            state[
                "telegram_status"
            ] = "SENT"

            state[
                "telegram_sent"
            ] = True

            state[
                "telegram_error"
            ] = ""

            state[
                "telegram_chat"
            ] = mask_chat_id(
                TELEGRAM_CHAT_ID
            )


        add_event(
            "Telegram SOS sent"
        )

        print(
            "TELEGRAM SOS SENT"
        )

        return True


    except Exception as error:

        error_text = str(
            error
        )

        with state_lock:

            state[
                "telegram_status"
            ] = "FAILED"

            state[
                "telegram_error"
            ] = error_text


        print(
            "TELEGRAM ERROR:",
            error_text
        )


        add_event(
            "Telegram SOS failed"
        )

        return False


def send_test_telegram():

    if not TELEGRAM_BOT_TOKEN:

        return (
            False,
            "TELEGRAM_BOT_TOKEN missing"
        )


    if not TELEGRAM_CHAT_ID:

        return (
            False,
            "TELEGRAM_CHAT_ID missing"
        )


    try:

        response = requests.post(

            (
                "https://api.telegram.org/"
                f"bot{TELEGRAM_BOT_TOKEN}"
                "/sendMessage"
            ),

            json={
                "chat_id":
                    TELEGRAM_CHAT_ID,

                "text":
                    (
                        "✅ DRIVER GUARD "
                        "TELEGRAM TEST\n\n"
                        "Telegram notifications "
                        "are working.\n\n"
                        "Student project simulation."
                    )
            },

            timeout=10
        )


        data = response.json()


        if (
            not response.ok
            or not data.get("ok")
        ):

            raise RuntimeError(

                data.get(
                    "description",
                    "Telegram test failed"
                )
            )


        with state_lock:

            state[
                "telegram_status"
            ] = "TEST SENT"

            state[
                "telegram_error"
            ] = ""

            state[
                "telegram_chat"
            ] = mask_chat_id(
                TELEGRAM_CHAT_ID
            )


        add_event(
            "Telegram test sent"
        )


        return True, ""


    except Exception as error:

        error_text = str(
            error
        )

        with state_lock:

            state[
                "telegram_status"
            ] = "TEST FAILED"

            state[
                "telegram_error"
            ] = error_text


        return (
            False,
            error_text
        )


def send_sos_if_location_ready():

    with state_lock:
        if not state["sos"]:
            return

        if state["telegram_sent"]:
            return

        latitude = state["latitude"]
        longitude = state["longitude"]
        accuracy = state["location_accuracy"]
        source = state["location_source"]


    # If we already have location, send immediately
    if (
        latitude is not None
        and longitude is not None
    ):

        send_telegram_sos(
            latitude,
            longitude,
            source or "UNKNOWN",
            accuracy
        )

        return


    # No browser/Windows location?
    # Automatically use internet/IP location.
    print(
        "No location available. "
        "Trying internet/IP location..."
    )

    with state_lock:
        state["telegram_status"] = (
            "GETTING INTERNET LOCATION"
        )


    try:

        result = get_ip_location()

        latitude = result["latitude"]
        longitude = result["longitude"]

        source = (
            "INTERNET / IP APPROXIMATE"
        )


        store_location(
            latitude=latitude,
            longitude=longitude,
            accuracy=None,
            source=source,
            label=result["label"]
        )


        print(
            "Internet location acquired:",
            latitude,
            longitude
        )


        # store_location() should already send Telegram.
        # This check prevents duplicate messages.

        with state_lock:
            already_sent = state[
                "telegram_sent"
            ]


        if not already_sent:

            send_telegram_sos(
                latitude,
                longitude,
                source,
                None
            )


    except Exception as error:

        error_text = str(error)

        print(
            "LOCATION FALLBACK ERROR:",
            error_text
        )


        with state_lock:

            state[
                "telegram_status"
            ] = (
                "LOCATION FAILED"
            )

            state[
                "telegram_error"
            ] = error_text

def get_ip_location():

    response = requests.get(

        "https://ipapi.co/json/",

        headers={
            "User-Agent":
                "DriverGuardStudentPrototype/1.0"
        },

        timeout=8
    )


    response.raise_for_status()


    data = response.json()


    latitude = data.get(
        "latitude"
    )

    longitude = data.get(
        "longitude"
    )


    if (
        latitude is None
        or longitude is None
    ):

        raise RuntimeError(
            "Internet geolocation "
            "did not return coordinates."
        )


    city = (
        data.get("city")
        or ""
    )

    region = (
        data.get("region")
        or ""
    )

    country = (
        data.get("country_name")
        or ""
    )


    label = ", ".join(

        value

        for value in [
            city,
            region,
            country
        ]

        if value
    )


    return {

        "latitude":
            float(latitude),

        "longitude":
            float(longitude),

        "label":
            label
            or "Approximate internet location"
    }


def find_port():

    if PORT:
        return PORT


    ports = list(

        serial.tools
        .list_ports
        .comports()
    )


    for port in ports:

        text = (

            f"{port.device} "
            f"{port.description} "
            f"{port.manufacturer or ''}"

        ).lower()


        if any(

            key in text

            for key in [

                "ch340",
                "ch341",
                "wch",
                "usb-serial",
                "usb serial"

            ]
        ):

            return port.device


    if len(ports) == 1:

        return ports[0].device


    return None


def parse_line(line):

    trigger_sos = False


    with state_lock:

        if line == "SYSTEM_READY":

            add_event(
                "ESP8266 system ready"
            )


        elif line == "EYE_OPEN":

            state["eye"] = "OPEN"

            state[
                "closed_ms"
            ] = 0

            state[
                "buzzer"
            ] = False


            if (
                state["sos"]
                or state["stopped"]
            ):

                state[
                    "speed"
                ] = 0

                state[
                    "brake"
                ] = 100

                state[
                    "stopped"
                ] = True

                state[
                    "sos"
                ] = True

                state[
                    "hazard"
                ] = True

                state[
                    "horn"
                ] = False

                state[
                    "system_state"
                ] = (
                    "EMERGENCY_STOP"
                )


                add_event(
                    "Eyes opened; "
                    "SOS remains latched"
                )


            else:

                reset_safety_state()

                add_event(
                    "Eyes opened"
                )


        elif line == "EYE_CLOSED":

            state[
                "eye"
            ] = "CLOSED"

            add_event(
                "Eyes closed"
            )


        elif line.startswith(
            "SENSOR:"
        ):

            try:

                state[
                    "sensor"
                ] = int(

                    line.split(
                        ":",
                        1
                    )[1]
                )

            except ValueError:
                pass


        elif line.startswith(
            "CLOSED_MS:"
        ):

            try:

                state[
                    "closed_ms"
                ] = int(

                    line.split(
                        ":",
                        1
                    )[1]
                )

            except ValueError:
                pass


        elif line.startswith(
            "BUZZER:"
        ):

            state[
                "buzzer"
            ] = line.endswith(
                "ON"
            )


        elif line.startswith(
            "BRAKE:"
        ):

            try:

                brake = int(

                    line.split(
                        ":",
                        1
                    )[1]
                )


                brake = max(
                    0,
                    min(
                        100,
                        brake
                    )
                )


                state[
                    "brake"
                ] = brake


                if not state[
                    "stopped"
                ]:

                    state[
                        "speed"
                    ] = round(

                        SIMULATED_START_SPEED

                        * (
                            1
                            - brake / 100
                        ),

                        1
                    )


            except ValueError:
                pass


        elif line.startswith(
            "SPEED:"
        ):

            try:

                state[
                    "speed"
                ] = max(

                    0,

                    float(

                        line.split(
                            ":",
                            1
                        )[1]
                    )
                )

            except ValueError:
                pass


        elif line == "HAZARD:ON":

            state[
                "hazard"
            ] = True


        elif line == "HAZARD:OFF":

            state[
                "hazard"
            ] = False


        elif line == "HORN:ON":

            state[
                "horn"
            ] = True


        elif line == "HORN:OFF":

            state[
                "horn"
            ] = False


        elif line.startswith(
            "STATE:"
        ):

            state[
                "system_state"
            ] = (

                line.split(
                    ":",
                    1
                )[1]
            )


        elif line == "VEHICLE_STOPPED":

            state[
                "stopped"
            ] = True

            state[
                "speed"
            ] = 0

            state[
                "brake"
            ] = 100


            add_event(
                "Simulation vehicle stopped"
            )


        elif line == "SOS:TRIGGER":

            state[
                "sos"
            ] = True

            state[
                "telegram_status"
            ] = (
                "WAITING FOR LOCATION"
            )


            add_event(
                "SOS simulation triggered"
            )


            trigger_sos = True


    if trigger_sos:

        send_sos_if_location_ready()


def serial_worker():

    while True:

        with state_lock:

            in_demo = state[
                "demo_mode"
            ]


        if in_demo:

            time.sleep(
                0.5
            )

            continue


        port = find_port()


        if not port:

            with state_lock:

                state[
                    "connected"
                ] = False

                state[
                    "port"
                ] = None


            time.sleep(
                2
            )

            continue


        try:

            with serial.Serial(

                port,
                BAUD,
                timeout=1

            ) as serial_port:


                time.sleep(
                    2
                )


                with state_lock:

                    state[
                        "connected"
                    ] = True

                    state[
                        "port"
                    ] = port


                add_event(

                    f"NodeMCU connected on {port}"
                )


                while True:

                    with state_lock:

                        if state[
                            "demo_mode"
                        ]:

                            break


                    raw = (
                        serial_port
                        .readline()
                    )


                    if not raw:
                        continue


                    line = (

                        raw.decode(
                            errors="ignore"
                        )

                        .strip()
                    )


                    if not line:
                        continue


                    print(
                        "ESP:",
                        line
                    )


                    parse_line(
                        line
                    )


        except (
            serial.SerialException,
            OSError
        ) as error:


            print(
                "Serial error:",
                error
            )


            with state_lock:

                state[
                    "connected"
                ] = False

                state[
                    "port"
                ] = None


            add_event(
                "USB serial disconnected"
            )


            time.sleep(
                2
            )


def demo_worker():

    while True:

        with state_lock:

            in_demo = state[
                "demo_mode"
            ]


        if not in_demo:

            time.sleep(
                0.2
            )

            continue


        with state_lock:

            reset_safety_state()

            state[
                "port"
            ] = "DEMO"


        add_event(
            "Demo mode started"
        )


        time.sleep(
            1
        )


        with state_lock:

            if not state[
                "demo_mode"
            ]:

                continue


            state[
                "eye"
            ] = "CLOSED"

            state[
                "system_state"
            ] = "MONITORING"


        add_event(
            "Demo eyes closed"
        )


        start = time.time()

        sos_triggered = False


        while True:

            with state_lock:

                if not state[
                    "demo_mode"
                ]:

                    break


            elapsed_ms = int(

                (
                    time.time()
                    - start
                )

                * 1000
            )


            trigger_send = False


            with state_lock:

                state[
                    "closed_ms"
                ] = elapsed_ms


                if elapsed_ms >= 2000:

                    state[
                        "buzzer"
                    ] = True


                if elapsed_ms < 5000:

                    state[
                        "system_state"
                    ] = (
                        "MONITORING"
                    )


                elif elapsed_ms < 10000:

                    state[
                        "system_state"
                    ] = "DROWSY"

                    state[
                        "hazard"
                    ] = True

                    state[
                        "horn"
                    ] = True


                    brake = int(

                        (
                            elapsed_ms
                            - 5000
                        )

                        / 5000

                        * 100
                    )


                    brake = max(

                        0,

                        min(
                            100,
                            brake
                        )
                    )


                    state[
                        "brake"
                    ] = brake


                    state[
                        "speed"
                    ] = round(

                        SIMULATED_START_SPEED

                        * (
                            1
                            - brake / 100
                        ),

                        1
                    )


                else:

                    state[
                        "system_state"
                    ] = (
                        "EMERGENCY_STOP"
                    )

                    state[
                        "brake"
                    ] = 100

                    state[
                        "speed"
                    ] = 0

                    state[
                        "hazard"
                    ] = True

                    state[
                        "horn"
                    ] = True

                    state[
                        "stopped"
                    ] = True

                    state[
                        "sos"
                    ] = True


                    if not sos_triggered:

                        state[
                            "telegram_status"
                        ] = (
                            "WAITING FOR LOCATION"
                        )


                        sos_triggered = True

                        trigger_send = True


                        add_event(
                            "Demo SOS triggered"
                        )


            if trigger_send:

                send_sos_if_location_ready()


            if elapsed_ms >= 10000:

                break


            time.sleep(
                0.1
            )


        while True:

            with state_lock:

                if not state[
                    "demo_mode"
                ]:

                    break


            time.sleep(
                0.2
            )


@app.route("/")
def index():

    return render_template(
        "index.html"
    )


@app.route(
    "/api/state"
)
def api_state():

    return jsonify(
        copy_state()
    )


@app.route(
    "/api/location",
    methods=["POST"]
)
def api_browser_location():

    payload = (

        request.get_json(
            silent=True
        )

        or {}
    )


    latitude = payload.get(
        "latitude"
    )

    longitude = payload.get(
        "longitude"
    )

    accuracy = payload.get(
        "accuracy"
    )


    if (
        latitude is None
        or longitude is None
    ):

        return jsonify({

            "ok":
                False,

            "error":
                "Missing latitude/longitude"

        }), 400


    try:

        maps_url = store_location(

            latitude=float(
                latitude
            ),

            longitude=float(
                longitude
            ),

            accuracy=(

                None

                if accuracy is None

                else float(
                    accuracy
                )
            ),

            source=(
                "WINDOWS / BROWSER"
            ),

            label=(
                "Browser geolocation"
            )
        )


        return jsonify({

            "ok":
                True,

            "maps_url":
                maps_url,

            "telegram_status":
                copy_state()[
                    "telegram_status"
                ]
        })


    except (
        TypeError,
        ValueError
    ):

        return jsonify({

            "ok":
                False,

            "error":
                "Invalid coordinates"

        }), 400


@app.route(
    "/api/ip-location",
    methods=[
        "GET",
        "POST"
    ]
)
def api_ip_location():

    try:

        result = (
            get_ip_location()
        )


        maps_url = store_location(

            latitude=result[
                "latitude"
            ],

            longitude=result[
                "longitude"
            ],

            accuracy=None,

            source=(
                "INTERNET / IP APPROXIMATE"
            ),

            label=result[
                "label"
            ]
        )


        return jsonify({

            "ok":
                True,

            "latitude":
                result[
                    "latitude"
                ],

            "longitude":
                result[
                    "longitude"
                ],

            "label":
                result[
                    "label"
                ],

            "maps_url":
                maps_url,

            "location_source":
                (
                    "INTERNET / IP APPROXIMATE"
                ),

            "telegram_status":
                copy_state()[
                    "telegram_status"
                ]
        })


    except Exception as error:

        error_text = str(
            error
        )


        print(
            "IP LOCATION ERROR:",
            error_text
        )


        add_event(
            "Internet geolocation failed"
        )


        return jsonify({

            "ok":
                False,

            "error":
                error_text

        }), 502


@app.route(
    "/api/test-telegram",
    methods=["POST"]
)
def api_test_telegram():

    ok, error = (
        send_test_telegram()
    )


    return jsonify({

        "ok":
            ok,

        "error":
            error,

        "state":
            copy_state()

    }), (
        200
        if ok
        else 400
    )


@app.route(
    "/api/reset",
    methods=["POST"]
)
def api_reset():

    with state_lock:

        state[
            "demo_mode"
        ] = False

        reset_safety_state()


    add_event(
        "Incident reset"
    )


    return jsonify({
        "ok": True
    })


@app.route(
    "/api/demo/start",
    methods=["POST"]
)
def demo_start():

    with state_lock:

        state[
            "demo_mode"
        ] = True


    return jsonify({
        "ok": True
    })


@app.route(
    "/api/demo/stop",
    methods=["POST"]
)
def demo_stop():

    with state_lock:

        state[
            "demo_mode"
        ] = False

        reset_safety_state()


    add_event(
        "Demo mode stopped"
    )


    return jsonify({
        "ok": True
    })


if __name__ == "__main__":

    threading.Thread(

        target=
            serial_worker,

        daemon=True

    ).start()


    threading.Thread(

        target=
            demo_worker,

        daemon=True

    ).start()


    print()

    print(
        "Driver Guard starting..."
    )


    print(

        "Telegram:",

        (
            "CONFIGURED"

            if (
                TELEGRAM_BOT_TOKEN
                and TELEGRAM_CHAT_ID
            )

            else "NOT CONFIGURED"
        )
    )


    print(

        "Telegram chat:",

        mask_chat_id(
            TELEGRAM_CHAT_ID
        )
    )


    print(
        "Location: "
        "Windows/browser + "
        "internet/IP fallback"
    )


    print(
        "Open: "
        "http://127.0.0.1:5000"
    )


    print()


    app.run(

        host=
            "127.0.0.1",

        port=
            5000,

        debug=
            False,

        threaded=
            True
    )