#define EYE_SENSOR A0
#define BUZZER D5

const int CLOSED_THRESHOLD = 300;

const unsigned long BUZZER_DELAY_MS = 2000;
const unsigned long DROWSY_START_MS = 5000;
const unsigned long FULL_STOP_MS = 10000;

bool eyeClosed = false;
bool buzzerOn = false;
bool stopped = false;

unsigned long eyeClosedStart = 0;
unsigned long lastMonitoringMessage = 0;

void setBuzzer(bool on) {
  if (buzzerOn == on) {
    return;
  }

  buzzerOn = on;

  digitalWrite(
    BUZZER,
    on ? HIGH : LOW
  );

  Serial.println(
    on ? "BUZZER:ON" : "BUZZER:OFF"
  );
}

void setup() {
  Serial.begin(9600);

  pinMode(
    BUZZER,
    OUTPUT
  );

  digitalWrite(
    BUZZER,
    LOW
  );

  Serial.println("SYSTEM_READY");
  Serial.println("STATE:NORMAL");
  Serial.println("BRAKE:0");
  Serial.println("HAZARD:OFF");
  Serial.println("HORN:OFF");
  Serial.println("BUZZER:OFF");
}

void loop() {
  int eyeValue =
    analogRead(
      EYE_SENSOR
    );

  Serial.print("SENSOR:");
  Serial.println(eyeValue);

  bool currentlyClosed =
    eyeValue >
    CLOSED_THRESHOLD;

  if (currentlyClosed) {
    if (!eyeClosed) {
      eyeClosed = true;
      stopped = false;

      eyeClosedStart =
        millis();

      Serial.println(
        "EYE_CLOSED"
      );
    }

    unsigned long closedTime =
      millis() -
      eyeClosedStart;

    Serial.print(
      "CLOSED_MS:"
    );

    Serial.println(
      closedTime
    );

    if (
      closedTime >=
      BUZZER_DELAY_MS
    ) {
      setBuzzer(true);
    }

    if (
      closedTime <
      DROWSY_START_MS
    ) {
      if (
        millis() -
        lastMonitoringMessage >=
        500
      ) {
        Serial.println(
          "STATE:MONITORING"
        );

        lastMonitoringMessage =
          millis();
      }
    }

    else if (
      closedTime <
      FULL_STOP_MS
    ) {
      Serial.println(
        "STATE:DROWSY"
      );

      Serial.println(
        "HAZARD:ON"
      );

      Serial.println(
        "HORN:ON"
      );

      int braking =
        map(
          closedTime,
          DROWSY_START_MS,
          FULL_STOP_MS,
          0,
          100
        );

      braking =
        constrain(
          braking,
          0,
          100
        );

      Serial.print(
        "BRAKE:"
      );

      Serial.println(
        braking
      );
    }

    else {
      if (!stopped) {
        stopped = true;

        Serial.println(
          "STATE:EMERGENCY_STOP"
        );

        Serial.println(
          "BRAKE:100"
        );

        Serial.println(
          "SPEED:0"
        );

        Serial.println(
          "HAZARD:ON"
        );

        Serial.println(
          "HORN:ON"
        );

        Serial.println(
          "VEHICLE_STOPPED"
        );

        Serial.println(
          "SOS:TRIGGER"
        );
      }
    }
  }

  else {
    if (eyeClosed) {
      Serial.println(
        "EYE_OPEN"
      );
    }

    eyeClosed = false;
    eyeClosedStart = 0;
    stopped = false;

    setBuzzer(false);

    Serial.println(
      "STATE:NORMAL"
    );

    Serial.println(
      "BRAKE:0"
    );

    Serial.println(
      "HAZARD:OFF"
    );

    Serial.println(
      "HORN:OFF"
    );
  }

  delay(100);
}
