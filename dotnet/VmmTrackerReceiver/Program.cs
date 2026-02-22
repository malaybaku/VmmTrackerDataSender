using System;
using System.Threading;
using System.Threading.Tasks;
using QRCoder;
using VmmTrackerCore;
using VmmTrackerWebRtc;

namespace VmmTrackerReceiver;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("=== VMM Tracker Data Receiver ===");
        Console.WriteLine();

        // Parse command line arguments
        string format = "compressed";
        string role = "offerer";
        string signaling = "auto";

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
            else if (args[i] == "--signaling" && i + 1 < args.Length)
            {
                signaling = args[i + 1].ToLowerInvariant();
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
        Console.WriteLine($"Signaling: {signaling}");
        Console.WriteLine();

        try
        {
            if (signaling == "auto" && role == "offerer")
            {
                await RunAutoSignaling(deserializer);
            }
            else
            {
                await RunManualSignaling(role, deserializer);
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

    static async Task RunAutoSignaling(ITrackingDataDeserializer deserializer)
    {
        using var receiver = new WebRTCReceiver(deserializer);
        SetupCommonHandlers(receiver);

        // Set up cancellation
        var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };

        // 1. Generate AES key and session token
        var aesKey = SignalingCrypto.GenerateKey();
        var token = SignalingCrypto.GenerateToken();

        Console.WriteLine($"Session token: {token}");
        Console.WriteLine();

        // 2. Capture compressed offer via event
        var offerTcs = new TaskCompletionSource<byte[]>();
        receiver.CompressedSdpReady += (data, isOffer) =>
        {
            if (isOffer)
            {
                offerTcs.TrySetResult(data);
            }
        };

        await receiver.InitializeAsOfferer();
        var offerBytes = await offerTcs.Task;

        // 3. Build URL
        var url = SignalingUrl.BuildUrl(token, aesKey, offerBytes);

        Console.WriteLine("=== Scan QR code or open the URL on mobile ===");
        Console.WriteLine();
        Console.WriteLine(url);
        Console.WriteLine();

        // 4. Save QR code as PNG file
        try
        {
            using var qrGenerator = new QRCodeGenerator();
            var qrData = qrGenerator.CreateQrCode(url, QRCodeGenerator.ECCLevel.L);
            var pngQr = new PngByteQRCode(qrData);
            var pngBytes = pngQr.GetGraphic(10);
            var qrPath = Path.Combine(AppContext.BaseDirectory, "qrcode.png");
            File.WriteAllBytes(qrPath, pngBytes);
            Console.WriteLine($"QR code saved to: {qrPath}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Warning] Could not save QR code: {ex.Message}");
        }

        Console.WriteLine();
        Console.WriteLine("Press Enter after the mobile has connected, to fetch the answer...");

        // 5. Wait for user input, then fetch answer
        await Task.Run(() => Console.ReadLine(), cts.Token);

        using var apiClient = new SignalingApiClient();
        var encryptedBase64 = await apiClient.GetAnswerAsync(token, cts.Token);
        if (encryptedBase64 == null)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Answer not found. The mobile may not have connected yet.");
            Console.ResetColor();
            return;
        }

        Console.WriteLine("Answer received! Decrypting...");

        // 6. Decrypt
        IAnswerDecryptor decryptor = new AesGcmAnswerDecryptor();
        var encryptedData = Convert.FromBase64String(encryptedBase64);
        var answerBytes = decryptor.Decrypt(aesKey, encryptedData);

        // 7. Set remote answer
        receiver.SetRemoteAnswer(answerBytes);
        Console.WriteLine("Remote answer set. Waiting for connection...");

        // Wait for connection
        await WaitAndReceive(receiver, cts);
    }

    static async Task RunManualSignaling(string role, ITrackingDataDeserializer deserializer)
    {
        using var receiver = new WebRTCReceiver(deserializer);
        SetupCommonHandlers(receiver);

        // Display compressed SDP as base64 in manual mode
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
            await receiver.InitializeAsOfferer();

            Console.WriteLine();
            Console.WriteLine("Paste the compressed answer (base64, single line) from the remote peer:");

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
            Console.WriteLine("Paste the compressed offer (base64, single line) from the remote peer:");

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

        await WaitAndReceive(receiver, cts);
    }

    static void SetupCommonHandlers(WebRTCReceiver receiver)
    {
        receiver.Log = Console.WriteLine;

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
    }

    static async Task WaitAndReceive(WebRTCReceiver receiver, CancellationTokenSource cts)
    {
        try
        {
            await receiver.WaitForConnection(cts.Token);
            Console.WriteLine();
            Console.WriteLine("WebRTC connection established!");
            Console.WriteLine("Receiving tracking data... Press Ctrl+C to stop.");
            Console.WriteLine();

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
