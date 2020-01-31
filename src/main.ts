import { app, BrowserWindow, ipcMain } from "electron";
import express from "express";
import bodyParser from "body-parser";

let win: BrowserWindow;

function createWindow() {
  // Создаем окно браузера.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
    titleBarStyle: "hidden",
  });

  win.webContents.openDevTools();

  // и загрузить index.html приложения.
  win.loadFile("../dist/index.html");
}

app.on("ready", createWindow);

const server = express();

server.use(bodyParser.json());
server.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

server.post("/", (req, res) => {
  ipcMain.once("asynchronous-message", (event, status) => {
    res.send(status);
    // Event emitter for sending asynchronous messages
    // event.sender.send("asynchronous-reply", "async pong");
  });

  const args: string[] = req.body.args;
  win.webContents.send("asynchronous-reply", args);
});

server.listen(3000, function() {
  console.log("Example app listening on port 3000!");
});
