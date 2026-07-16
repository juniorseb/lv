import { Module } from '@nestjs/common';

import { VehicleCapsService } from './vehicle-caps.service';

// Module feuille (dépend seulement de la config) : politique de plafonnement des
// modes doux, partagée par matching et deliveries sans créer de cycle.
@Module({
  providers: [VehicleCapsService],
  exports: [VehicleCapsService],
})
export class VehicleCapsModule {}
