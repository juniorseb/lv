import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { deliveriesApi } from '../../api/deliveries';
import DeliveryHistoryList from './DeliveryHistoryList';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverHistory'>;

// Historique des courses effectuées par le livreur (spec-app-navigation-roles §7).
export default function DriverHistoryScreen({ navigation }: Props) {
  const query = useQuery({
    queryKey: ['driver-history'],
    queryFn: () => deliveriesApi.driverHistory(),
  });

  return (
    <DeliveryHistoryList
      data={query.data}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      emptyLabel="Aucune course effectuée"
      emptySubtitle="Passez en Disponible pour recevoir vos premières missions."
      onPressItem={(d) =>
        navigation.navigate('ActiveDelivery', { deliveryId: d.id })
      }
    />
  );
}
