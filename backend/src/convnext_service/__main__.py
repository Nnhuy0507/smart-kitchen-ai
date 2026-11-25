import os
import socket
import sys
from threading import Thread

import uvicorn
from .app import app


def stop_with_backend():
    sys.stdin.buffer.read()
    os._exit(0)


def main():
    Thread(target=stop_with_backend, daemon=True).start()
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        print(listener.getsockname()[1], flush=True)
        uvicorn.Server(uvicorn.Config(
            app, access_log=False,
        )).run(sockets=[listener])


if __name__ == '__main__':
    main()
