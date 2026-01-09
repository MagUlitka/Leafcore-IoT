import logging
import signal
import subprocess
from bluezero import peripheral
from bluezero import localGATT
from bluezero import async_tools
from bluezero import adapter

LEAFCORE_SERVICE_UUID = "c62a771b-095e-4f60-a383-bca1f8f96210"
SSID_CHAR_UUID = "5c3dc741-7850-4b0a-ac77-1ea26bdb73f1"
PASS_CHAR_UUID = "5c3dc741-7850-4b0a-ac77-1ea26bdb73f2"
SSID_EXEC_CHAR_UUID = "5c3dc741-7850-4b0a-ac77-1ea26bdb73f3"
PASS_EXEC_CHAR_UUID = "5c3dc741-7850-4b0a-ac77-1ea26bdb73f4"
DEVICE_NAME_PREFIX = "LC_Greenhouse"


class WifiConfigurator:
    def __init__(self):
        self.ssid_buffer = b"" 
        self.pass_buffer = b""
        self.ssid = None
        self.password = None

    def on_ssid_write(self, value, options):
        self.ssid_buffer += bytes(value)
        logging.info(f"Appended SSID chunk. Buffer is now {len(self.ssid_buffer)} bytes.")

    def on_pass_write(self, value, options):
        self.pass_buffer += bytes(value)
        logging.info(f"Appended Password chunk. Buffer is now {len(self.pass_buffer)} bytes.")

    def on_ssid_execute(self, value, options):
        logging.info("SSID Execute received. Decoding buffer...")
        try:
            self.ssid = self.ssid_buffer.decode('utf-8')
            logging.info(f"Decoded SSID: {self.ssid}")
        except Exception as e:
            logging.error(f"Error decoding SSID: {e}")
        finally:
            self.ssid_buffer = b""
            self.attempt_connect()

    def on_pass_execute(self, value, options):
        logging.info("Password Execute received. Decoding buffer...")
        try:
            self.password = self.pass_buffer.decode('utf-8')
            logging.info("Decoded Password (hidden)")
        except Exception as e:
            logging.error(f"Error decoding password: {e}")
        finally:
            self.pass_buffer = b""
            self.attempt_connect()

    def attempt_connect(self):
        if not self.ssid or not self.password:
            logging.warning("Missing credentials, waiting for both...")
            return

        logging.info(f"Attempting to connect to SSID: {self.ssid}")
        try:
            cmd = ['nmcli', 'dev', 'wifi', 'connect', self.ssid, 'password', self.password]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
            logging.info(f"NetworkManager output: {result.stdout}")
            logging.info("--- Successfully connected to Wi-Fi! ---")
        except FileNotFoundError:
            logging.error("--- 'nmcli' command not found. ---")
        except subprocess.TimeoutExpired:
            logging.error("--- Wi-Fi connection timed out. ---")
        except subprocess.CalledProcessError as e:
            logging.error("--- Failed to connect to Wi-Fi. ---")
            logging.error(f"nmcli error: {e.stderr}")
        finally:
            self.ssid = None
            self.password = None

def main():
    logging.basicConfig(level=logging.INFO)
    mainloop = async_tools.EventLoop()
    config = WifiConfigurator()

    try:
        dongle = adapter.Adapter()
        logging.info(f"Using adapter: {dongle.address}")
        my_server = peripheral.Peripheral(
            adapter_address=dongle.address,
            local_name="LC_Greenhouse"
        )
        logging.info(f"Adding service: {LEAFCORE_SERVICE_UUID}")
        my_server.add_service(
            srv_id=0,
            uuid=LEAFCORE_SERVICE_UUID,
            primary=True
        )

        logging.info(f"Adding SSID characteristic: {SSID_CHAR_UUID}")
        my_server.add_characteristic(
            srv_id=0, chr_id=0, uuid=SSID_CHAR_UUID, value=[], notifying=False,
            flags=['write', 'write-without-response'],
            read_callback=None,
            write_callback=config.on_ssid_write
        )

        logging.info(f"Adding Password characteristic: {PASS_CHAR_UUID}")
        my_server.add_characteristic(
            srv_id=0, chr_id=1, uuid=PASS_CHAR_UUID, value=[], notifying=False,
            flags=['write', 'write-without-response'],
            read_callback=None,
            write_callback=config.on_pass_write
        )

        logging.info(f"Adding SSID Execute characteristic: {SSID_EXEC_CHAR_UUID}")
        my_server.add_characteristic(
            srv_id=0, chr_id=2, uuid=SSID_EXEC_CHAR_UUID, value=[], notifying=False,
            flags=['write'],
            read_callback=None,
            write_callback=config.on_ssid_execute
        )

        logging.info(f"Adding Password Execute characteristic: {PASS_EXEC_CHAR_UUID}")
        my_server.add_characteristic(
            srv_id=0, chr_id=3, uuid=PASS_EXEC_CHAR_UUID, value=[], notifying=False,
            flags=['write'],
            read_callback=None,
            write_callback=config.on_pass_execute
        )

        my_server.publish()
        logging.info("Server is published and broadcasting. Press Ctrl+C to stop.")
        mainloop.run()

    except adapter.AdapterError as e:
        logging.error(f"Bluetooth Error: {e}")
    except KeyboardInterrupt:
        logging.info("\nStopping server.")
    finally:
        logging.info("Shutting down...")
        if 'mainloop' in locals() and mainloop.is_running():
            mainloop.quit()

if __name__ == "__main__":
    main()
