import time
import threading
import gpiod
from gpiod.line import Direction, Value
from flask import Flask, request, jsonify
import config
import datetime
import json
import os

app = Flask(__name__)

# device_state = {
#     "light": {"state": "off", "intensity": 0.0},
#     "fan": {"state": "off"},
#     "pump": {"state": "off"},
#     "heat": {"state": "off"}
# }

device_state = {
"light": {"device_name": "LC_Greenhouse_Module_Light001",
"type": "light",
"state": "off",
"mode": "auto",
"intensity": 0.0,
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"fan": {"device_name": "LC_Greenhouse_Module_Fan001",
"type": "fan",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"pump": {"device_name": "LC_Greenhouse_Module_Pump001",
"type": "water pump",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"sprinkler": {"device_name": "LC_Greenhouse_Module_Sprinkler001",
"type": "sprinkler",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"heat_mat": {"device_name": "LC_Greenhouse_Module_Heat001",
"type": "heating mat",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"temp_hum_sensor": {"device_name": "LC_Greenhouse_Module_TempHumSensor001",
"type": "temperature and humidity sensor",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"light_sensor": {"device_name": "LC_Greenhouse_Module_LightSensor001",
"type": "light sensor",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())},

"water_level_sensor": {"device_name": "LC_Greenhouse_Module_WaterLevelSensor001",
"type": "water level sensor",
"state": "off",
"mode": "auto",
"group_id": "LC_Greenhouse_Box_ModuleGroup001",
"last_edit_date": str(datetime.datetime.now())}
}

current_dir = os.path.dirname(os.path.abspath(__file__))
sensor_data_file = os.path.join(current_dir, "sensor_data.json")
settings_file = os.path.join(current_dir, "source_files", "dummy_setting.json")

PWM_FREQUENCY = 100  
PWM_PERIOD = 1.0 / PWM_FREQUENCY

class GPIOController(threading.Thread):
    def __init__(self):
        super().__init__()
        self.running = True
        self.daemon = True

    def run(self):
        print("GPIO Started")
        try:
            with gpiod.request_lines(
                path=config.CHIP_PATH,
                consumer="gpio_service",
                config={
                    config.FAN_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.PUMP_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.SPRINKLER_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.HEATING_MAT_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.LIGHT_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                },
            ) as request:

                while self.running:
                    try:
                        with open(settings_file, 'r') as f:
                            settings = json.load(f)
                        
                        with open(sensor_data_file, 'r') as f:
                            sensor_list = json.load(f)
                        
                        if sensor_list:
                            newest = sensor_list[0]
                            temp = newest.get('temperature')
                            humid = newest.get('humidity')
                            bright = newest.get('brightness')
                            
                            current_time_str = datetime.datetime.now().strftime("%H:%M")
                            start_time = settings['light_schedule']['start_time']
                            end_time = settings['light_schedule']['end_time']
                            
                            if device_state["light"]["mode"] == "auto":
                                if start_time <= current_time_str <= end_time:
                                    device_state["light"]["state"] = "on"
                                    if bright is not None:
                                        device_state["light"]["intensity"] = min(1.0, max(0.0, bright / settings.get('optimal_light', 1.0)))
                                    else:
                                        device_state["light"]["intensity"] = 1.0
                                else:
                                    device_state["light"]["state"] = "off"
                            
                            if device_state["fan"]["mode"] == "auto" and temp is not None:
                                if temp > settings['optimal_temperature']:
                                    device_state["fan"]["state"] = "on"
                                else:
                                    if humid is not None:
                                        if humid > settings['optimal_humidity']:
                                            device_state["fan"]["state"] = "on"
                                        else:
                                            device_state["fan"]["state"] = "off"
                            else:
                                device_state["fan"]["state"] = "off"
                            
                            if device_state["heat_mat"]["mode"] == "auto" and temp is not None:
                                if temp < settings['optimal_temperature']:
                                    device_state["heat_mat"]["state"] = "on"
                                else:
                                    device_state["heat_mat"]["state"] = "off"
                            
                            if device_state["sprinkler"]["mode"] == "auto" and humid is not None:
                                if humid < settings['optimal_humidity']:
                                    device_state["sprinkler"]["state"] = "on"
                                else:
                                    device_state["sprinkler"]["state"] = "off"
                    
                    except Exception as e:
                        print(f"Automation error: {e}")
                    
                    fan_val = Value.ACTIVE if device_state["fan"]["state"] == "on" else Value.INACTIVE
                    request.set_value(config.FAN_PIN, fan_val)

                    pump_val = Value.ACTIVE if device_state["pump"]["state"] == "on" else Value.INACTIVE
                    request.set_value(config.PUMP_PIN, pump_val)

                    sprinkler_val = Value.ACTIVE if device_state["sprinkler"]["state"] == "on" else Value.INACTIVE
                    request.set_value(config.SPRINKLER_PIN, sprinkler_val)

                    heat_val = Value.ACTIVE if device_state["heat_mat"]["state"] == "on" else Value.INACTIVE
                    request.set_value(config.HEATING_MAT_PIN, heat_val)

                    light_conf = device_state["light"]
                    if light_conf["state"] == "on":
                        intensity = light_conf.get("intensity", 1.0)

                        if intensity >= 1.0:
                            request.set_value(config.LIGHT_PIN, Value.ACTIVE)
                            time.sleep(PWM_PERIOD)
                        elif intensity <= 0.0:
                            request.set_value(config.LIGHT_PIN, Value.INACTIVE)
                            time.sleep(PWM_PERIOD)
                        else:
                            on_time = PWM_PERIOD * intensity
                            off_time = PWM_PERIOD * (1.0 - intensity)
                            request.set_value(config.LIGHT_PIN, Value.ACTIVE)
                            time.sleep(on_time)
                            request.set_value(config.LIGHT_PIN, Value.INACTIVE)
                            time.sleep(off_time)
                    else:
                        request.set_value(config.LIGHT_PIN, Value.INACTIVE)
                        time.sleep(0.01)

        except Exception as e:
            print(f"GPIO Thread Crashed: {e}")

@app.route('/device-control', methods=['POST'])
def update_device():
    """
    JSON data:
    {
        "component": "light",
        "action": "on",
        "intensity": 0.5 
    }
    """
    data = request.json
    component = data.get("component")
    action = data.get("action")

    if component not in config.COMPONENT_MAP:
        return jsonify({"error": "Invalid component"}), 400

    if component == "light":
        intensity = data.get("intensity")
        device_state["light"]["state"] = action
        if intensity is not None:
            device_state["light"]["intensity"] = max(0.0, min(1.0, float(intensity)))
    else:
        device_state[component]["state"] = action

    return jsonify({"state": "success", "current_state": device_state[component]})

@app.route('/device-mode-edit', methods=['POST'])
def device_mode_edit():
    """
    JSON data:
    {
        "component": "light",
        "mode": "manual"
    }
    """
    data = request.json
    component = data.get("component")
    action = data.get("mode")

    if component not in config.COMPONENT_MAP:
        return jsonify({"error": "Invalid component"}), 400

    if component == "light" or component == "pump" or component == "sprinkler":
        device_state[component]["mode"] = "manual"
        return jsonify({"state": "success", "current_state": device_state[component]["mode"]})
    else:
        return jsonify({"error": "Invalid component for mode change"}), 400
    

@app.route('/device-state', methods=['GET'])
def get_state():
    return jsonify(device_state)

if __name__ == '__main__':
    def run_web_server():
     print("Starting Web Server on Port 5000...")
     app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    server_thread = threading.Thread(target=run_web_server)
    server_thread.daemon = True
    server_thread.start()

    time.sleep(1)

    print("Starting GPIO Controller...")
    try:
        controller = GPIOController()
        controller.run()
    except KeyboardInterrupt:
        print("\nTurning off all devices...")
        for dev in device_state:
            device_state[dev]["state"] = "off"
        try:
            with gpiod.request_lines(
                path=config.CHIP_PATH,
                consumer="shutdown_cleanup",
                config={
                    config.FAN_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.PUMP_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.SPRINKLER_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.HEATING_MAT_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                    config.LIGHT_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=Value.INACTIVE),
                },
            ) as request:
                request.set_value(config.FAN_PIN, Value.INACTIVE)
                request.set_value(config.PUMP_PIN, Value.INACTIVE)
                request.set_value(config.SPRINKLER_PIN, Value.INACTIVE)
                request.set_value(config.HEATING_MAT_PIN, Value.INACTIVE)
                request.set_value(config.LIGHT_PIN, Value.INACTIVE)
        except Exception as e:
            print(f"GPIO cleanup error: {e}")
        print("Stopping...")