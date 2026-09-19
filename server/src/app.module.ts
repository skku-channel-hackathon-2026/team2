import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ChannelAppModule, SignatureGuard } from "@channel.io/app-sdk-server";
import { channelAppOptions } from "./config.js";
import { CommandExtension } from "./commands.js";
import { TutorialFunctions } from "./tutorial.functions.js";
import { BallFunctions } from "./modules/ball/ball.functions.js";
import { ReviewFunctions } from "./modules/review/review.functions.js";
import { DexFunctions } from "./modules/dex/dex.functions.js";

@Module({
  imports: [ChannelAppModule.forRoot(channelAppOptions)],
  providers: [
    CommandExtension,
    TutorialFunctions,
    BallFunctions,
    ReviewFunctions,
    DexFunctions,
    {
      provide: APP_GUARD,
      useFactory: () => new SignatureGuard(channelAppOptions),
    },
  ],
})
export class AppModule {}
