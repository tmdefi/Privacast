// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/config/ZamaFHEVMConfig.sol";

/**
 * PrivaCast — Private Prediction Market
 * Stage 4: Real FHE encryption on Sepolia via Zama fhEVM
 * Bet amounts and sides are fully encrypted on-chain.
 * Nobody — not even the contract owner — can see your position.
 */
contract PrivaCast is SepoliaZamaFHEVMConfig {

    // ── STRUCTS ──
    struct Market {
        string  title;
        string  category;
        uint256 createdAt;
        bool    resolved;
        bool    outcome; // true = YES won, false = NO won
    }

    struct EncryptedPosition {
        euint32 amount;    // encrypted bet amount — nobody can see this
        ebool   side;      // encrypted side (true=YES, false=NO) — nobody can see this
        bool    exists;
        bool    claimed;
    }

    // ── STATE ──
    address public owner;
    uint256 public marketCount;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => EncryptedPosition)) private positions;
    mapping(uint256 => uint256) public totalBettors; // count only, not amounts

    // ── EVENTS ──
    event MarketCreated(uint256 indexed marketId, string title, string category);
    event PositionPlaced(uint256 indexed marketId, address indexed user);
    event MarketResolved(uint256 indexed marketId, bool outcome);

    // ── MODIFIERS ──
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    modifier marketExists(uint256 marketId) {
        require(marketId < marketCount, "Market does not exist");
        _;
    }
    modifier notResolved(uint256 marketId) {
        require(!markets[marketId].resolved, "Already resolved");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── CREATE MARKET ──
    function createMarket(string calldata title, string calldata category)
        external onlyOwner returns (uint256)
    {
        uint256 id = marketCount++;
        markets[id] = Market({
            title:     title,
            category:  category,
            createdAt: block.timestamp,
            resolved:  false,
            outcome:   false
        });
        emit MarketCreated(id, title, category);
        return id;
    }

    // ── PLACE ENCRYPTED PREDICTION ──
    // The user encrypts their amount and side in the browser using Zama's SDK
    // The contract receives encrypted ciphertext — never sees the real values
    function placePosition(
        uint256 marketId,
        einput encryptedAmount,
        einput encryptedSide,
        bytes calldata inputProof
    )
        external
        marketExists(marketId)
        notResolved(marketId)
    {
        // Verify and store encrypted inputs — values stay encrypted
        euint32 amount = TFHE.asEuint32(encryptedAmount, inputProof);
        ebool   side   = TFHE.asEbool(encryptedSide, inputProof);

        // Allow the contract to use these encrypted values
        TFHE.allow(amount, address(this));
        TFHE.allow(side, address(this));

        // Store the encrypted position
        positions[marketId][msg.sender] = EncryptedPosition({
            amount:  amount,
            side:    side,
            exists:  true,
            claimed: false
        });

        // Grant the user permission to decrypt their own position
        TFHE.allow(amount, msg.sender);
        TFHE.allow(side,   msg.sender);

        // Grant the contract permission to use these values later
        TFHE.allow(amount, address(this));
        TFHE.allow(side,   address(this));

        // Only increment public counter — no amounts or sides revealed
        totalBettors[marketId]++;

        emit PositionPlaced(marketId, msg.sender);
    }

    // ── RESOLVE MARKET ──
    function resolveMarket(uint256 marketId, bool outcome)
        external
        onlyOwner
        marketExists(marketId)
        notResolved(marketId)
    {
        markets[marketId].resolved = true;
        markets[marketId].outcome  = outcome;
        emit MarketResolved(marketId, outcome);
    }

    // ── VIEW FUNCTIONS ──
    function hasPosition(uint256 marketId, address user)
        external view marketExists(marketId) returns (bool)
    {
        return positions[marketId][user].exists;
    }

    function getMarket(uint256 marketId)
        external view marketExists(marketId)
        returns (string memory title, string memory category, uint256 createdAt, bool resolved, bool outcome, uint256 bettors)
    {
        Market storage m = markets[marketId];
        return (m.title, m.category, m.createdAt, m.resolved, m.outcome, totalBettors[marketId]);
    }

    // Returns encrypted handles — only the position owner can decrypt these
    function getMyPosition(uint256 marketId)
        external view marketExists(marketId)
        returns (euint32 amount, ebool side, bool exists, bool claimed)
    {
        EncryptedPosition storage p = positions[marketId][msg.sender];
        return (p.amount, p.side, p.exists, p.claimed);
    }
}
