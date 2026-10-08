# c4 Lab tool map

This map reflects c4 Lab's local tool registry at skill release. Confirm the route still exists before instructing the investigator. c4 Lab results are derived evidence and must be preserved with source inputs, run time, and limitations.

| Investigative question | Tool and route | Appropriate input | Key limitation |
|---|---|---|---|
| What is the SHA-256 of an evidence copy? | Hash Calculator — `/encryption/hash-calc` | Copy of file or exact text | A hash supports integrity comparison, not authenticity |
| Does this file match an expected digest? | File Hash Verify — `/file/hash-verify` | Evidence copy and expected hash | A match does not prove provenance |
| What file format/signature is present? | File Type Identifier — `/file/type-id` | Evidence copy | Type identification is not malware analysis |
| What visible text appears in an image? | Screenshot OCR — `/image/ocr` | Preserved working copy | OCR errors require comparison with the original |
| What does this QR code encode? | QR Decode — `/image/qr-decode` | Preserved image copy | Do not automatically visit or execute decoded content |
| What metadata remains in an image? | EXIF Extractor — `/image/exif` | Original or documented copy | Missing or editable metadata is not proof of manipulation |
| Which structured indicators occur in text? | Text Extractor — `/text/extract` | Transcript, export, or working text | Validate every identifier against its source |
| What registration data is available for a domain? | WHOIS Lookup — `/osint/whois` | Domain | Privacy/proxy data and registrant fields do not prove control |
| What DNS records resolve now? | DNS Lookup — `/osint/dns` | Domain | Current DNS may differ from incident-time DNS |
| What hostname maps from an IP? | Reverse DNS — `/osint/reverse-dns` | IP address | PTR records are weak attribution evidence |
| What network/location metadata exists for an IP? | IP Geolocation — `/osint/ip-geo` | IP address | Geolocation is approximate and not a person's location |
| Where else does a handle appear? | Username OSINT — `/osint/username` | Username | Same username does not establish same person |
| What exposed-service data exists? | Shodan Lookup — `/osint/shodan` | IP or domain | Observations may be historical or shared infrastructure |
| What activity is associated with a wallet? | Wallet Profiler — `/wallet/wallet-profiler` | Validated address and chain | Activity does not establish beneficial ownership |
| Does an address have known risk/service labels? | Address Intel — `/bad` | Wallet address | Labels are leads; verify provenance and date |
| How did funds move from selected addresses? | Transaction Graph — `/blockchain/transaction-graph` | Seed transaction/address, chain, scope | Graph proximity is not attribution; off-chain flows are hidden |
| What occurred in a specific transaction? | Transaction Receipt — `/blockchain/transaction-receipt` | Transaction hash and chain | A receipt does not explain off-chain purpose or ownership |
| What function/calldata was invoked? | EVM Tx Decoder — `/blockchain/evm-tx-decoder` | EVM transaction | Decoding does not prove intent |
| Were internal EVM calls involved? | Internal Transactions — `/blockchain/internal-txns` | EVM transaction/address | Provider traces may vary and exclude off-chain activity |
| What is known about a smart contract? | Contract Analyzer — `/blockchain/contract-analyzer` | Contract address and chain | Metadata or code indicators do not by themselves prove fraud |

## Excluded from routine recommendations

Do not recommend Transaction Broadcast, UTXO Broadcast, Seed Investigator, Seed Recovery, Seed Creator, or credential/keystore operations during ordinary case guidance. These can move funds, expose secrets, or exceed scope. Any exceptional use requires explicit lawful authority, a controlled environment, specialist procedure, and independent approval.
