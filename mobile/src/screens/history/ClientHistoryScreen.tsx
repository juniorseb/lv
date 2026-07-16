import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { deliveriesApi } from '../../api/deliveries';
import DeliveryHistoryList from './DeliveryHistoryList';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ClientHistory'>;

// Historique des expéditions du client (spec-app-navigation-roles §7).
export default function ClientHistoryScreen({ navigation }: Props) {
  const query = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: () => deliveriesApi.listMine(),
  });

  return (
    <DeliveryHistoryList
      data={query.data}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      emptyLabel="Aucune expédition pour le moment"
      emptySubtitle="Vos colis envoyés apparaîtront ici. Envoyez-en un depuis l'accueil."
      onPressItem={(d) =>
        navigation.navigate('DeliverySearch', { deliveryId: d.id })
      }
    />
  );
}
