/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <folly/dynamic.h>
#include <ABI44_0_0jsi/ABI44_0_0jsi.h>

namespace ABI44_0_0facebook {
namespace jsi {

ABI44_0_0facebook::jsi::Value valueFromDynamic(
    ABI44_0_0facebook::jsi::Runtime& runtime,
    const folly::dynamic& dyn);

folly::dynamic dynamicFromValue(
    ABI44_0_0facebook::jsi::Runtime& runtime,
    const ABI44_0_0facebook::jsi::Value& value);

} // namespace jsi
} // namespace ABI44_0_0facebook
