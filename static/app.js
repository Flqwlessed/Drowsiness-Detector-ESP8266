const $ = (id) => document.getElementById(id);

let lastState = null;
let demoMode = false;
let locationRequested = false;
let sosPopupShownForCurrentEvent = false;

let visualSpeed = 60;
let targetSpeed = 60;
let visualBrake = 0;

let carDistance = 0;
let carLaneOffset = 0;
let carBounceTime = 0;

let roadTravel = 0;
let sceneryTravel = 0;

let lastAnimationTime = performance.now();

let audioContext = null;
let engineOscillator = null;
let engineOscillator2 = null;
let engineGain = null;
let engineFilter = null;

let hornOsc1 = null;
let hornOsc2 = null;
let hornGain = null;

let audioEnabled = false;

function ensureAudio() {
  if (audioEnabled) return;

  audioContext = new (
    window.AudioContext ||
    window.webkitAudioContext
  )();

  engineOscillator = audioContext.createOscillator();
  engineOscillator2 = audioContext.createOscillator();

  engineOscillator.type = "sawtooth";
  engineOscillator2.type = "triangle";

  engineFilter = audioContext.createBiquadFilter();
  engineFilter.type = "lowpass";

  engineGain = audioContext.createGain();
  engineGain.gain.value = 0.02;

  engineOscillator.connect(engineFilter);
  engineOscillator2.connect(engineFilter);

  engineFilter.connect(engineGain);
  engineGain.connect(audioContext.destination);

  engineOscillator.start();
  engineOscillator2.start();

  hornOsc1 = audioContext.createOscillator();
  hornOsc2 = audioContext.createOscillator();

  hornOsc1.type = "square";
  hornOsc2.type = "square";

  hornOsc1.frequency.value = 415;
  hornOsc2.frequency.value = 495;

  hornGain = audioContext.createGain();
  hornGain.gain.value = 0;

  hornOsc1.connect(hornGain);
  hornOsc2.connect(hornGain);

  hornGain.connect(audioContext.destination);

  hornOsc1.start();
  hornOsc2.start();

  audioEnabled = true;

  if ($("audioButton")) {
    $("audioButton").textContent = "🔊 Audio on";
    $("audioButton").classList.add("active");
  }
}

async function updateAudio(state) {
  if (!audioEnabled || !audioContext) return;

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const now = audioContext.currentTime;
  const speedRatio = Math.max(0, Math.min(1, visualSpeed / 60));
  const engineFrequency = 48 + speedRatio * 72;

  engineOscillator.frequency.setTargetAtTime(
    engineFrequency,
    now,
    0.08
  );

  engineOscillator2.frequency.setTargetAtTime(
    engineFrequency * 2,
    now,
    0.08
  );

  engineFilter.frequency.setTargetAtTime(
    220 + speedRatio * 420,
    now,
    0.08
  );

  engineGain.gain.setTargetAtTime(
    visualSpeed > 1
      ? 0.015 + speedRatio * 0.025
      : 0.004,
    now,
    0.08
  );

  hornGain.gain.setTargetAtTime(
    state.horn ? 0.075 : 0,
    now,
    0.025
  );
}

function updateConnection(state) {
  const badge = $("connectionBadge");
  const text = $("connectionText");

  if (!badge || !text) return;

  if (state.demo_mode) {
    badge.classList.add("online");
    text.textContent = "Demo simulation";
    return;
  }

  badge.classList.toggle("online", state.connected);

  text.textContent = state.connected
    ? `ESP8266 connected • ${state.port}`
    : "ESP8266 disconnected";
}

function updateDriver(state) {
  if ($("eyeStatus")) {
    $("eyeStatus").textContent = state.eye;
  }

  if ($("sensorValue")) {
    $("sensorValue").textContent =
      state.sensor === null ? "—" : state.sensor;
  }

  if ($("closedSeconds")) {
    $("closedSeconds").textContent =
      (state.closed_ms / 1000).toFixed(1);
  }

  if ($("buzzerStatus")) {
    $("buzzerStatus").textContent =
      state.buzzer ? "ON" : "OFF";

    $("buzzerStatus").style.color =
      state.buzzer ? "#ff5569" : "";
  }

  if ($("systemState")) {
    $("systemState").textContent =
      state.system_state.replaceAll("_", " ");
  }

  if ($("eyeVisual")) {
    $("eyeVisual").className =
      "eye-visual " +
      (
        state.eye === "CLOSED"
          ? "closed"
          : "open"
      );
  }

  if ($("sensorBar") && state.sensor !== null) {
    const percent = Math.max(
      0,
      Math.min(
        100,
        state.sensor / 1023 * 100
      )
    );

    $("sensorBar").style.width =
      percent + "%";
  }
}

function updateBraking(state) {
  visualBrake =
    Number(state.brake) || 0;

  const brake =
    Math.round(visualBrake);

  if ($("brakeValue")) {
    $("brakeValue").textContent =
      brake;
  }

  if ($("brakeBar")) {
    $("brakeBar").style.width =
      brake + "%";
  }

  const hazard =
    $("hazardBox");

  if (hazard) {
    hazard.classList.toggle(
      "active",
      state.hazard
    );

    const text =
      hazard.querySelector("b");

    if (text) {
      text.textContent =
        state.hazard ? "ON" : "OFF";
    }
  }

  const horn =
    $("hornBox");

  if (horn) {
    horn.classList.toggle(
      "active",
      state.horn
    );

    const text =
      horn.querySelector("b");

    if (text) {
      text.textContent =
        state.horn ? "ON" : "OFF";
    }
  }
}

function updateVehicle(state) {
  targetSpeed =
    Math.max(
      0,
      Number(state.speed) || 0
    );

  const car = $("car");

  if (car) {
    car.classList.toggle(
      "moving",
      visualSpeed > 1
    );

    car.classList.toggle(
      "stopped",
      state.stopped
    );

    car.classList.toggle(
      "braking",
      visualBrake > 0
    );
  }

  const brakeOn =
    visualBrake > 0;

  if ($("leftBrake")) {
    $("leftBrake")
      .classList
      .toggle(
        "on",
        brakeOn
      );
  }

  if ($("rightBrake")) {
    $("rightBrake")
      .classList
      .toggle(
        "on",
        brakeOn
      );
  }

  const hazardFlash =
    state.hazard &&
    Math.floor(
      Date.now() / 420
    ) % 2 === 0;

  if ($("leftHazard")) {
    $("leftHazard")
      .classList
      .toggle(
        "flash",
        hazardFlash
      );
  }

  if ($("rightHazard")) {
    $("rightHazard")
      .classList
      .toggle(
        "flash",
        hazardFlash
      );
  }

  if ($("stopMarker")) {
    $("stopMarker")
      .classList
      .toggle(
        "show",
        state.stopped
      );
  }

  if ($("decelerationOverlay")) {
    $("decelerationOverlay")
      .classList
      .toggle(
        "show",
        visualBrake > 0 &&
        !state.stopped
      );
  }

  if ($("heroTitle")) {
    if (state.system_state === "NORMAL") {
      $("heroTitle").textContent =
        "Cruising normally";
    }

    else if (
      state.system_state ===
      "MONITORING"
    ) {
      $("heroTitle").textContent =
        "Eyes closed — monitoring driver";
    }

    else if (
      state.system_state ===
      "DROWSY"
    ) {
      $("heroTitle").textContent =
        "Drowsiness detected — decelerating";
    }

    else {
      $("heroTitle").textContent =
        "Emergency stop completed";
    }
  }
}

function showSosModal() {
  const backdrop =
    $("sosModalBackdrop");

  if (!backdrop) return;

  backdrop.classList.add("show");
  document.body.classList.add(
    "modal-open"
  );
}

function hideSosModal() {
  const backdrop =
    $("sosModalBackdrop");

  if (!backdrop) return;

  backdrop.classList.remove("show");
  document.body.classList.remove(
    "modal-open"
  );
}

function updateSosModal(state) {
  if ($("modalSmsStatus")) {
    $("modalSmsStatus").textContent =
      state.sms_status || "WAITING";
  }

  if (
    state.latitude !== null &&
    state.longitude !== null
  ) {
    const locationText =
      `${Number(state.latitude).toFixed(6)}, ` +
      `${Number(state.longitude).toFixed(6)}`;

    if ($("modalLocationText")) {
      $("modalLocationText").textContent =
        locationText;
    }
  }

  if (
    state.maps_url &&
    $("modalMapsButton")
  ) {
    $("modalMapsButton").href =
      state.maps_url;

    $("modalMapsButton")
      .classList
      .remove(
        "disabled"
      );
  }
}

function updateSOS(state) {
  if ($("sosCircle")) {
    $("sosCircle")
      .classList
      .toggle(
        "active",
        state.sos
      );
  }

  if ($("sosStatus")) {
    $("sosStatus").textContent =
      state.sos
        ? "SOS TRIGGERED"
        : "STANDBY";
  }

  if ($("smsStatus")) {
    $("smsStatus").textContent =
      state.sms_status || "STANDBY";
  }

  if ($("sosDescription")) {
    $("sosDescription").textContent =
      state.sos
        ? "Vehicle simulation stopped. Preparing live location and SOS message."
        : "SOS simulation will trigger after a complete simulated stop.";
  }

  if (
    state.sos &&
    state.stopped &&
    !sosPopupShownForCurrentEvent
  ) {
    sosPopupShownForCurrentEvent =
      true;

    showSosModal();
  }

  if (
    state.sos &&
    !locationRequested
  ) {
    locationRequested =
      true;

    if (
      state.latitude !== null &&
      state.longitude !== null
    ) {
      resendStoredLocationForSos(state);
    } else {
      requestLocation();
    }
  }

  if (!state.sos) {
    locationRequested = false;
    sosPopupShownForCurrentEvent = false;

    hideSosModal();

    if ($("locationText")) {
      $("locationText").textContent =
        "Waiting for SOS…";
    }

    if ($("modalLocationText")) {
      $("modalLocationText").textContent =
        "Requesting current location…";
    }

    if ($("mapsButton")) {
      $("mapsButton").href = "#";
      $("mapsButton")
        .classList
        .add(
          "disabled"
        );
    }

    if ($("modalMapsButton")) {
      $("modalMapsButton").href = "#";
      $("modalMapsButton")
        .classList
        .add(
          "disabled"
        );
    }
  }

  if (
    state.latitude !== null &&
    state.longitude !== null
  ) {
    let text =
      `Latitude: ${Number(
        state.latitude
      ).toFixed(6)}\n` +
      `Longitude: ${Number(
        state.longitude
      ).toFixed(6)}`;

    if (
      state.location_accuracy !==
      null
    ) {
      text +=
        `\nAccuracy: ±${Math.round(
          state.location_accuracy
        )} m`;
    }

    if ($("locationText")) {
      $("locationText").textContent =
        text;
    }
  }

  if (
    state.maps_url &&
    $("mapsButton")
  ) {
    $("mapsButton").href =
      state.maps_url;

    $("mapsButton")
      .classList
      .remove(
        "disabled"
      );
  }

  updateSosModal(state);
}

function updateEvents(state) {
  const box =
    $("events");

  if (!box) return;

  box.innerHTML = "";

  for (const event of state.events) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "event";

    const time =
      document.createElement(
        "time"
      );

    time.textContent =
      event.time;

    const message =
      document.createElement(
        "span"
      );

    message.textContent =
      event.message;

    row.append(
      time,
      message
    );

    box.appendChild(
      row
    );
  }
}


async function applyLocationPayload(payload, sourceLabel) {
  if ($("locationText")) {
    $("locationText").textContent =
      `Latitude: ${Number(payload.latitude).toFixed(6)}\n` +
      `Longitude: ${Number(payload.longitude).toFixed(6)}\n` +
      `Source: ${sourceLabel}`;
  }

  if ($("modalLocationText")) {
    $("modalLocationText").textContent =
      `${Number(payload.latitude).toFixed(6)}, ` +
      `${Number(payload.longitude).toFixed(6)}`;
  }

  try {
    const response =
      await fetch(
        "/api/location",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(
              payload
            )
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Could not save location"
      );
    }

    if (
      result.maps_url &&
      $("mapsButton")
    ) {
      $("mapsButton").href =
        result.maps_url;

      $("mapsButton")
        .classList
        .remove(
          "disabled"
        );
    }

    if (
      result.maps_url &&
      $("modalMapsButton")
    ) {
      $("modalMapsButton").href =
        result.maps_url;

      $("modalMapsButton")
        .classList
        .remove(
          "disabled"
        );
    }

    if (
      result.sms_status &&
      $("modalSmsStatus")
    ) {
      $("modalSmsStatus").textContent =
        result.sms_status;
    }

    if ($("manualLocationMessage")) {
      $("manualLocationMessage").textContent =
        lastState && lastState.sos
          ? `Location accepted. SOS status: ${result.sms_status}`
          : "Location saved. Start the demo; this location will be used when SOS triggers.";

      $("manualLocationMessage")
        .classList
        .add(
          "success"
        );
    }

    return result;
  }

  catch (error) {
    console.error(
      "Location API error:",
      error
    );

    if ($("manualLocationMessage")) {
      $("manualLocationMessage").textContent =
        "Could not save location: " +
        error.message;

      $("manualLocationMessage")
        .classList
        .remove(
          "success"
        );
    }

    throw error;
  }
}


async function resendStoredLocationForSos(state) {
  const payload = {
    latitude:
      Number(state.latitude),

    longitude:
      Number(state.longitude),

    accuracy:
      state.location_accuracy ?? 10
  };

  try {
    await applyLocationPayload(
      payload,
      "Saved manual location"
    );
  }

  catch (error) {
    console.error(
      "Could not resend saved location for SOS:",
      error
    );
  }
}


async function saveManualLocation() {
  const latInput =
    $("manualLatitude");

  const lonInput =
    $("manualLongitude");

  if (
    !latInput ||
    !lonInput
  ) {
    return;
  }

  const latitude =
    Number(
      latInput.value.trim()
    );

  const longitude =
    Number(
      lonInput.value.trim()
    );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    if ($("manualLocationMessage")) {
      $("manualLocationMessage").textContent =
        "Enter both latitude and longitude numbers.";
    }

    return;
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    if ($("manualLocationMessage")) {
      $("manualLocationMessage").textContent =
        "Coordinates are outside the valid latitude/longitude range.";
    }

    return;
  }

  const payload = {
    latitude,
    longitude,
    accuracy: 10
  };

  await applyLocationPayload(
    payload,
    "Manual coordinates"
  );
}


async function requestLocation() {
  if (!navigator.geolocation) {
    if ($("locationText")) {
      $("locationText").textContent =
        "Browser geolocation unavailable.";
    }

    if ($("modalLocationText")) {
      $("modalLocationText").textContent =
        "Browser location unavailable.";
    }

    return;
  }

  if ($("locationText")) {
    $("locationText").textContent =
      "Requesting location permission…";
  }

  if ($("modalLocationText")) {
    $("modalLocationText").textContent =
      "Requesting current location…";
  }

  navigator.geolocation.getCurrentPosition(

    async position => {
      const payload = {
        latitude:
          position.coords.latitude,

        longitude:
          position.coords.longitude,

        accuracy:
          position.coords.accuracy
      };

      try {
        await applyLocationPayload(
          payload,
          `Windows location ±${Math.round(payload.accuracy)} m`
        );
      }

      catch (error) {
        console.error(
          "Location API error:",
          error
        );
      }
    },

    error => {
      if ($("locationText")) {
        $("locationText").textContent =
          "Location unavailable: " +
          error.message;
      }

      if ($("modalLocationText")) {
        $("modalLocationText").textContent =
          "Location unavailable.";
      }
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function animateCar(delta) {
  const car = $("car");

  if (!car || !lastState) {
    return;
  }

  const speedRatio =
    Math.max(
      0,
      Math.min(
        1,
        visualSpeed / 60
      )
    );

  const brakeRatio =
    Math.max(
      0,
      Math.min(
        1,
        visualBrake / 100
      )
    );

  carDistance +=
    visualSpeed *
    delta *
    0.085;

  const laneWave =
    Math.sin(
      carDistance * 0.24
    );

  carLaneOffset =
    laneWave *
    21 *
    speedRatio;

  const forwardTravel =
    Math.sin(
      carDistance * 0.095
    ) *
    28 *
    speedRatio;

  carBounceTime +=
    delta *
    (
      4 +
      speedRatio * 10
    );

  const suspension =
    Math.sin(
      carBounceTime
    ) *
    3.2 *
    speedRatio;

  const brakingDrop =
    brakeRatio *
    13;

  const brakingPitch =
    brakeRatio *
    2.4;

  const stopMultiplier =
    visualSpeed < 0.7
      ? 0
      : 1;

  const horizontalMovement =
    carLaneOffset *
    stopMultiplier;

  const verticalMovement =
    (
      forwardTravel +
      suspension +
      brakingDrop
    ) *
    stopMultiplier;

  car.style.transform =
    `
    translateX(
      calc(
        -50% + ${horizontalMovement}px
      )
    )
    translateY(
      ${verticalMovement}px
    )
    rotateZ(
      ${laneWave * 1.3 * speedRatio}deg
    )
    rotateX(
      ${brakingPitch}deg
    )
    scale(
      ${1 - brakeRatio * 0.018}
    )
    `;

  car.style.left =
    `calc(50% + ${
      Math.sin(
        carDistance * 0.11
      ) *
      16 *
      speedRatio
    }px)`;

  const rims =
    document.querySelectorAll(
      ".wheel-rim"
    );

  const wheelRotation =
    carDistance *
    80;

  rims.forEach(
    rim => {
      rim.style.transform =
        `rotate(${wheelRotation}deg)`;
    }
  );
}

function animateRoad(delta) {
  roadTravel +=
    visualSpeed *
    delta *
    2.7;

  const lanes =
    document.querySelectorAll(
      ".lane"
    );

  lanes.forEach(
    (
      lane,
      index
    ) => {
      const spacing = 75;
      const cycle =
        spacing *
        lanes.length;

      const distance =
        (
          index *
          spacing +
          roadTravel
        ) %
        cycle;

      const normalized =
        distance /
        cycle;

      const perspectiveScale =
        0.25 +
        normalized *
        1.7;

      lane.style.transform =
        `
        translateY(
          ${distance}px
        )
        scale(
          ${perspectiveScale}
        )
        `;

      lane.style.opacity =
        Math.min(
          1,
          0.25 +
          normalized *
          1.2
        );
    }
  );

  const texture =
    document.querySelector(
      ".road-texture"
    );

  if (texture) {
    texture.style.backgroundPositionY =
      roadTravel +
      "px";
  }

  sceneryTravel +=
    visualSpeed *
    delta *
    1.8;

  const objects =
    document.querySelectorAll(
      ".road-tree, .road-pole"
    );

  objects.forEach(
    (
      object,
      index
    ) => {
      const spacing = 125;
      const cycle = 700;

      const distance =
        (
          index *
          spacing +
          sceneryTravel
        ) %
        cycle;

      const normalized =
        distance /
        cycle;

      const scale =
        0.25 +
        normalized *
        1.55;

      object.style.transform =
        `
        translateY(
          ${distance}px
        )
        scale(
          ${scale}
        )
        `;

      object.style.opacity =
        Math.min(
          1,
          0.18 +
          normalized *
          1.15
        );
    }
  );

  document
    .querySelectorAll(
      ".cloud"
    )
    .forEach(
      (
        cloud,
        index
      ) => {
        const movement =
          (
            roadTravel *
            (
              0.015 +
              index *
              0.008
            )
          ) %
          150;

        cloud.style.marginLeft =
          -movement +
          "px";
      }
    );

  const farTrees =
    document.querySelector(
      ".far-tree-line"
    );

  if (farTrees) {
    farTrees.style.transform =
      `translateX(${
        -(roadTravel * 0.02) % 30
      }px)`;
  }
}

function animationLoop(timestamp) {
  const delta =
    Math.min(
      0.05,
      (
        timestamp -
        lastAnimationTime
      ) /
      1000
    );

  lastAnimationTime =
    timestamp;

  if (lastState) {
    const difference =
      targetSpeed -
      visualSpeed;

    const responseSpeed =
      targetSpeed <
      visualSpeed
        ? 1.55
        : 2.8;

    visualSpeed +=
      difference *
      Math.min(
        1,
        delta *
        responseSpeed
      );

    if (
      Math.abs(
        targetSpeed -
        visualSpeed
      ) < 0.03
    ) {
      visualSpeed =
        targetSpeed;
    }

    if ($("speedValue")) {
      $("speedValue").textContent =
        Math.round(
          visualSpeed
        );
    }

    animateRoad(delta);
    animateCar(delta);
    updateAudio(lastState);

    if ($("vehicleMotionState")) {
      if (visualSpeed <= 0.7) {
        $("vehicleMotionState").textContent =
          "STOPPED";
      }

      else if (visualBrake > 0) {
        $("vehicleMotionState").textContent =
          "DECELERATING";
      }

      else {
        $("vehicleMotionState").textContent =
          "MOVING";
      }
    }
  }

  requestAnimationFrame(
    animationLoop
  );
}

async function pollState() {
  try {
    const response =
      await fetch(
        "/api/state",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}`
      );
    }

    const state =
      await response.json();

    lastState = state;
    demoMode = state.demo_mode;

    updateConnection(state);
    updateDriver(state);
    updateBraking(state);
    updateVehicle(state);
    updateSOS(state);
    updateEvents(state);

    if ($("demoButton")) {
      $("demoButton").textContent =
        state.demo_mode
          ? "■ Stop demo"
          : "▶ Demo mode";

      $("demoButton")
        .classList
        .toggle(
          "active",
          state.demo_mode
        );
    }
  }

  catch (error) {
    if ($("connectionText")) {
      $("connectionText").textContent =
        "Dashboard server unavailable";
    }

    if ($("connectionBadge")) {
      $("connectionBadge")
        .classList
        .remove(
          "online"
        );
    }

    console.error(error);
  }
}

if ($("audioButton")) {
  $("audioButton").addEventListener(
    "click",
    async () => {
      ensureAudio();

      if (
        audioContext &&
        audioContext.state ===
        "suspended"
      ) {
        await audioContext.resume();
      }
    }
  );
}

if ($("demoButton")) {
  $("demoButton").addEventListener(
    "click",
    async () => {
      const endpoint =
        demoMode
          ? "/api/demo/stop"
          : "/api/demo/start";

      try {
        await fetch(
          endpoint,
          {
            method: "POST"
          }
        );
      }

      catch (error) {
        console.error(error);
      }
    }
  );
}

if ($("closeSosModal")) {
  $("closeSosModal").addEventListener(
    "click",
    () => {
      hideSosModal();
    }
  );
}

if ($("sosModalBackdrop")) {
  $("sosModalBackdrop").addEventListener(
    "click",
    event => {
      if (
        event.target ===
        $("sosModalBackdrop")
      ) {
        hideSosModal();
      }
    }
  );
}

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      hideSosModal();
    }
  }
);

if ($("setManualLocationButton")) {
  $("setManualLocationButton").addEventListener(
    "click",
    async () => {
      try {
        await saveManualLocation();
      }

      catch (error) {
        console.error(
          "Manual location failed:",
          error
        );
      }
    }
  );
}


if ($("testLocationButton")) {
  $("testLocationButton").addEventListener(
    "click",
    () => {
      locationRequested = false;
      requestLocation();
    }
  );
}

if ($("resetIncidentButton")) {
  $("resetIncidentButton").addEventListener(
    "click",
    async () => {
      try {
        await fetch(
          "/api/reset",
          {
            method: "POST"
          }
        );

        locationRequested = false;
        sosPopupShownForCurrentEvent = false;
        hideSosModal();

        await pollState();
      }

      catch (error) {
        console.error(
          "Reset failed:",
          error
        );
      }
    }
  );
}


setInterval(
  pollState,
  150
);

requestAnimationFrame(
  animationLoop
);

pollState();
