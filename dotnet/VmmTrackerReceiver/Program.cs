using System;
using System.Threading;
using System.Threading.Tasks;
using VmmTrackerCore;

namespace VmmTrackerReceiver;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("=== VMM Tracker Data Receiver ===");
        Console.WriteLine();

        // Parse command line arguments
        string mode = "websocket"; // Default to WebSocket for backward compatibility
        int port = 9090;
        string format = "compressed";
        string role = "answerer"; // WebRTC role: offerer or answerer

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--mode" && i + 1 < args.Length)
            {
                mode = args[i + 1].ToLowerInvariant();
            }
            else if (args[i] == "--port" && i + 1 < args.Length)
            {
                if (int.TryParse(args[i + 1], out var p))
                {
                    port = p;
                }
            }
            else if (args[i] == "--format" && i + 1 < args.Length)
            {
                format = args[i + 1].ToLowerInvariant();
            }
            else if (args[i] == "--role" && i + 1 < args.Length)
            {
                role = args[i + 1].ToLowerInvariant();
            }
        }

        // Select deserializer
        ITrackingDataDeserializer deserializer = format switch
        {
            "compressed" => new CompressedDeserializer(),
            "readable" => new ReadableDeserializer(),
            _ => throw new ArgumentException($"Unknown format: {format}. Use 'compressed' or 'readable'")
        };

        Console.WriteLine($"Mode: {mode}");
        Console.WriteLine($"Format: {format}");
        if (mode == "websocket")
        {
            Console.WriteLine($"Port: {port}");
        }
        else if (mode == "webrtc")
        {
            Console.WriteLine($"Role: {role}");
        }
        Console.WriteLine();

        try
        {
            if (mode == "websocket")
            {
                RunWebSocketMode(port, deserializer);
            }
            else if (mode == "webrtc")
            {
                await RunWebRTCMode(role, deserializer);
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"Unknown mode: {mode}. Use 'websocket' or 'webrtc'");
                Console.ResetColor();
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Fatal error: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            Console.ResetColor();
        }
    }

    static void RunWebSocketMode(int port, ITrackingDataDeserializer deserializer)
    {
        using var server = new WebSocketServer(port, deserializer);

        server.DataReceived += (data) =>
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}] Received tracking data:");
            Console.WriteLine(data);
            Console.WriteLine();
        };

        server.ErrorOccurred += (error) =>
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[ERROR] {error}");
            Console.ResetColor();
        };

        server.Start();
        Console.WriteLine($"WebSocket server started on ws://localhost:{port}");
        Console.WriteLine("Press Ctrl+C to stop...");
        Console.WriteLine();

        // Wait for Ctrl+C
        var exitEvent = new ManualResetEvent(false);
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            exitEvent.Set();
        };

        exitEvent.WaitOne();

        Console.WriteLine();
        Console.WriteLine("Shutting down...");
    }

    static async Task RunWebRTCMode(string role, ITrackingDataDeserializer deserializer)
    {
        using var receiver = new WebRTCReceiver(deserializer);

        receiver.DataReceived += (data) =>
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}] Received tracking data:");
            Console.WriteLine(data);
            Console.WriteLine();
        };

        receiver.ErrorOccurred += (error) =>
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[ERROR] {error}");
            Console.ResetColor();
        };

        // Set up cancellation
        var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };

        if (role == "offerer")
        {
            // PC generates offer
            await receiver.InitializeAsOfferer();

            Console.WriteLine("Copy the Offer SDP above and send it to the remote peer (web browser).");
            Console.WriteLine();
            Console.WriteLine("Paste the Answer SDP from the remote peer below and press Enter:");
            Console.WriteLine("(Multi-line input: end with a line containing only '---')");

            string answerSdp = ReadMultiLineInput();

            receiver.SetRemoteAnswer(answerSdp);
            Console.WriteLine();
            Console.WriteLine("Answer SDP set. Waiting for connection...");
        }
        else if (role == "answerer")
        {
            // PC receives offer from web
            Console.WriteLine("Paste the Offer SDP from the remote peer (web browser) below and press Enter:");
            Console.WriteLine("(Multi-line input: end with a line containing only '---')");

            string offerSdp = ReadMultiLineInput();

            await receiver.InitializeAsAnswerer(offerSdp);

            Console.WriteLine("Copy the Answer SDP above and send it to the remote peer (web browser).");
            Console.WriteLine();
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Unknown role: {role}. Use 'offerer' or 'answerer'");
            Console.ResetColor();
            return;
        }

        // Wait for ICE candidates
        Console.WriteLine();
        Console.WriteLine("Waiting for ICE candidates...");
        Console.WriteLine("(This may take a few seconds)");
        await Task.Delay(2000); // Give time for ICE gathering

        Console.WriteLine();
        Console.WriteLine("If you received ICE candidates from the remote peer, paste them now.");
        Console.WriteLine("Otherwise, press Enter to skip.");
        Console.WriteLine("(Format: one JSON per line, end with empty line)");

        // TODO: Add ICE candidate input handling (optional for now)

        // Wait for connection
        try
        {
            await receiver.WaitForConnection(cts.Token);
            Console.WriteLine();
            Console.WriteLine("WebRTC connection established!");
            Console.WriteLine("Receiving tracking data... Press Ctrl+C to stop.");
            Console.WriteLine();

            // Keep running until Ctrl+C
            while (!cts.Token.IsCancellationRequested)
            {
                await Task.Delay(100, cts.Token);
            }
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine();
            Console.WriteLine("Shutting down...");
        }
    }

    static string ReadMultiLineInput()
    {
        var lines = new System.Text.StringBuilder();
        string? line;

        while ((line = Console.ReadLine()) != null)
        {
            if (line.Trim() == "---")
            {
                break;
            }

            lines.AppendLine(line);
        }

        return lines.ToString().Trim();
    }
}
