using System;
using VmmTrackerCore;

namespace VmmTrackerReceiver;

class Program
{
    static void Main(string[] args)
    {
        Console.WriteLine("=== VMM Tracker Data Receiver ===");
        Console.WriteLine();

        // Parse command line arguments
        int port = 8080;
        string format = "compressed";

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--port" && i + 1 < args.Length)
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
        }

        // Select deserializer
        ITrackingDataDeserializer deserializer = format switch
        {
            "compressed" => new CompressedDeserializer(),
            "readable" => new ReadableDeserializer(),
            _ => throw new ArgumentException($"Unknown format: {format}. Use 'compressed' or 'readable'")
        };

        Console.WriteLine($"Port: {port}");
        Console.WriteLine($"Format: {format}");
        Console.WriteLine();

        // Start WebSocket server
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

        try
        {
            server.Start();
            Console.WriteLine($"WebSocket server started on ws://localhost:{port}");
            Console.WriteLine("Press Ctrl+C to stop...");
            Console.WriteLine();

            // Wait for Ctrl+C
            var exitEvent = new System.Threading.ManualResetEvent(false);
            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                exitEvent.Set();
            };

            exitEvent.WaitOne();

            Console.WriteLine();
            Console.WriteLine("Shutting down...");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Fatal error: {ex.Message}");
            Console.ResetColor();
        }
    }
}
