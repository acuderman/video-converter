const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
require('@electron/remote/main').initialize();

// Add FFmpeg path configuration
const getFfmpegPath = () => {
    // For development, check both common FFmpeg locations
    if (process.env.NODE_ENV !== 'production') {
        const possiblePaths = [
            '/opt/homebrew/bin/ffmpeg',    // M1/M2 Mac Homebrew path
            '/usr/local/bin/ffmpeg',       // Intel Mac Homebrew path
            '/usr/bin/ffmpeg'              // System path
        ];

        const validPath = possiblePaths.find(p => fs.existsSync(p));
        if (!validPath) {
            console.error('FFmpeg not found in any expected location!');
            console.log('Checked paths:', possiblePaths);
            throw new Error('FFmpeg not found');
        }
        
        console.log('Development mode, using FFmpeg at:', validPath);
        return validPath;
    }

    // Production mode
    const resourcePath = path.join(process.resourcesPath, 'ffmpeg');
    console.log('Production mode, using bundled FFmpeg at:', resourcePath);
    return resourcePath;
};

// Log the FFmpeg path for debugging
const ffmpegPath = getFfmpegPath();
console.log('Using FFmpeg path:', ffmpegPath);
console.log('Path exists:', fs.existsSync(ffmpegPath));

// Set FFmpeg path for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

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