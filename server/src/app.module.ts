import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ChannelAppModule, SignatureGuard } from "@channel.io/app-sdk-server";
import { channelAppOptions } from "./config.js";
import { CommandActions, CommandExtension } from "./commands.extension.js";
import { AccountsService } from "./accounts.service.js";
import { AvailabilityService } from "./availability.service.js";
import { ChannelService } from "./channel.service.js";
import { NotificationsService } from "./notifications.service.js";
import { SettingsService } from "./settings.service.js";
import { UpgradeService } from "./upgrade.service.js";
import { AccountFunctions } from "./functions/account.functions.js";
import { UpgradeFunctions } from "./functions/upgrade.functions.js";
import { SeniorFunctions } from "./functions/senior.functions.js";
import { AvailabilityFunctions } from "./functions/availability.functions.js";
import { OpsFunctions } from "./functions/ops.functions.js";
import { BallFunctions } from "./modules/ball/ball.functions.js";
import { ReviewFunctions } from "./modules/review/review.functions.js";
import { DexFunctions } from "./modules/dex/dex.functions.js";
import { EncounterFunctions } from "./modules/encounter/encounter.functions.js";
import { WildFunctions } from "./modules/wild/wild.functions.js";
import { AnswersFunctions } from "./modules/answers/answers.functions.js";
import { KnowledgeFunctions } from "./modules/knowledge/knowledge.functions.js";

@Module({
  imports: [ChannelAppModule.forRoot(channelAppOptions)],
  providers: [
    SettingsService,
    AccountsService,
    AvailabilityService,
    UpgradeService,
    ChannelService,
    NotificationsService,
    CommandExtension,
    CommandActions,
    AccountFunctions,
    UpgradeFunctions,
    SeniorFunctions,
    AvailabilityFunctions,
    OpsFunctions,
    BallFunctions,
    ReviewFunctions,
    DexFunctions,
    EncounterFunctions,
    WildFunctions,
    AnswersFunctions,
    KnowledgeFunctions,
    {
      provide: APP_GUARD,
      useFactory: () => new SignatureGuard(channelAppOptions),
    },
  ],
})
export class AppModule {}
