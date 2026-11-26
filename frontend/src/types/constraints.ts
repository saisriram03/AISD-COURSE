export type HardConstraintStatus = {
  key: string;
  label: string;
  status: 'ENFORCED' | 'PARTIAL' | 'NOT_IMPLEMENTED';
  explanation: string;
};

export type SoftConstraintSetting = {
  key: string;
  label: string;
  enabled: boolean;
  weight: number;
};

export type ConstraintConfiguration = {
  department_id: string;
  hard_constraints: HardConstraintStatus[];
  soft_constraints: SoftConstraintSetting[];
};

export type ConstraintConfigurationPayload = Pick<ConstraintConfiguration, 'soft_constraints'>;
