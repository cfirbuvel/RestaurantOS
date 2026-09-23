/**
 * [PHASE 18 MIGRATION SHIM]
 * Connected to canonical StatusBadge from @restaurantos/shared-mobile.
 */

import React from "react";
import {
  StatusBadge as SharedStatusBadge,
  StatusBadgeProps as SharedStatusBadgeProps,
} from "@restaurantos/shared-mobile";

export interface Props extends Omit<SharedStatusBadgeProps, "label"> {
  customLabel?: string;
  label?: string;
}

export const StatusBadge: React.FC<Props> = ({ customLabel, label, ...rest }) => {
  return <SharedStatusBadge label={customLabel || label} {...rest} />;
};
