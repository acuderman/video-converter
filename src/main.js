const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
require('@electron/remote/main').initialize();

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false,
        backgroundColor: '#ffffff'
    });

    require('@electron/remote/main').enable(win.webContents);
    win.loadFile(path.join(__dirname, 'index.html'));

    win.once('ready-to-show', () => {
        win.show();
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('process-video', (event, data) => {
    if (!data.inputPath) {
        event.reply('conversion-error', 'No input file path provided');
        return;
    }

    console.log('Processing file:', data.inputPath);
    console.log('Output file:', data.outputPath);
    console.log('Settings:', data.settings);
    
    try {
        ffmpeg(data.inputPath)
            .outputOptions([
                `-vf scale=-2:${data.settings.scale}`,
                '-c:v libx264',
                `-crf ${data.settings.crf}`,
                `-preset ${data.settings.preset}`,
                `-b:v ${data.settings.videoBitrate}k`,
                `-maxrate ${data.settings.videoBitrate}k`,
                `-bufsize ${data.settings.bufferSize}k`,
                '-c:a aac',
                `-b:a ${data.settings.audioBitrate}k`,
                '-movflags +faststart'
            ])
            .output(data.outputPath)
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                console.log('Progress:', progress.percent);
                event.reply('conversion-progress', progress.percent);
            })
            .on('end', () => {
                console.log('Conversion complete');
                event.reply('conversion-complete', data.outputPath);
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                event.reply('conversion-error', err.message);
            })
            .run();
    } catch (error) {
        console.error('Error starting FFmpeg:', error);
        event.reply('conversion-error', error.message);
    }
});