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
        string format = "compressed";
        string role = "answerer"; // WebRTC role: offerer or answerer

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--format" && i + 1 < args.Length)
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

        Console.WriteLine($"Format: {format}");
        Console.WriteLine($"Role: {role}");
        Console.WriteLine();

        try
        {
            await RunWebRTCMode(role, deserializer);
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Fatal error: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            Console.ResetColor();
        }
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

        // Temporary: convert to base64 for console display (will be replaced by new UX)
        receiver.CompressedSdpReady += (data, isOffer) =>
        {
            var base64 = Convert.ToBase64String(data);
            var label = isOffer ? "Offer" : "Answer";
            Console.WriteLine();
            Console.WriteLine($"--- Compressed {label} (base64) ---");
            Console.WriteLine(base64);
            Console.WriteLine($"--- End ---");
            Console.WriteLine();
            Console.WriteLine($"Copy the base64 string above and send it to the remote peer.");
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

            Console.WriteLine();
            Console.WriteLine("Paste the compressed answer (base64, single line) from the remote peer:");

            // Temporary: convert from base64 console input (will be replaced by new UX)
            string? answerBase64 = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(answerBase64))
            {
                Console.WriteLine("No answer provided. Exiting.");
                return;
            }

            receiver.SetRemoteAnswer(Convert.FromBase64String(answerBase64.Trim()));
            Console.WriteLine();
            Console.WriteLine("Remote answer set. Waiting for connection...");
        }
        else if (role == "answerer")
        {
            // PC receives offer from web
            Console.WriteLine("Paste the compressed offer (base64, single line) from the remote peer:");

            // Temporary: convert from base64 console input (will be replaced by new UX)
            string? offerBase64 = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(offerBase64))
            {
                Console.WriteLine("No offer provided. Exiting.");
                return;
            }

            await receiver.InitializeAsAnswerer(Convert.FromBase64String(offerBase64.Trim()));
            Console.WriteLine();
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Unknown role: {role}. Use 'offerer' or 'answerer'");
            Console.ResetColor();
            return;
        }

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
}
