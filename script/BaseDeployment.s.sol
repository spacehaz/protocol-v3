// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "./CurveParams.sol";

// Libraries
import "../src/Curve.sol";
import "../src/Config.sol";

// Factories
import "../src/CurveFactoryV3.sol";

// Zap
import "../src/Zap.sol";
import "../src/Router.sol";
import "./Addresses.sol";

// Base DEPLOYMENT
contract ContractScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address OWNER = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // first deploy the config
        int128 protocolFee = 50_000;
        Config config = new Config(protocolFee, OWNER);

        // Deploy Assimilator
        AssimilatorFactory deployedAssimFactory = new AssimilatorFactory(address(config));

        // Deploy CurveFactoryV3
        CurveFactoryV3 deployedCurveFactory =
            new CurveFactoryV3(address(deployedAssimFactory), address(config), Base.WETH);

        // Attach CurveFactoryV3 to Assimilator
        deployedAssimFactory.setCurveFactory(address(deployedCurveFactory));

        // deploy eurc-usdc curve
        IOracle usdOracle = IOracle(Base.CHAINLINK_USDC_USD);
        IOracle eurcOracle = IOracle(Base.CHAINLINK_EURC_USD);

        // eurc-usdc curve info
        CurveFactoryV3.CurveInfo memory eurcUsdcCurveInfo = CurveFactoryV3.CurveInfo(
            "dfx-eurc-usdc-v3",
            "dfx-eurc-usdc-v3",
            Base.EURC,
            Base.USDC,
            CurveParams.BASE_WEIGHT,
            CurveParams.QUOTE_WEIGHT,
            eurcOracle,
            usdOracle,
            CurveParams.ALPHA,
            CurveParams.BETA,
            CurveParams.MAX,
            Base.EURC_EPSILON,
            CurveParams.LAMBDA
        );

        // Deploy curve
        deployedCurveFactory.newCurve(eurcUsdcCurveInfo);
        Zap zap = new Zap(address(deployedCurveFactory));
        Router router = new Router(address(deployedCurveFactory));
        vm.stopBroadcast();
    }
}
